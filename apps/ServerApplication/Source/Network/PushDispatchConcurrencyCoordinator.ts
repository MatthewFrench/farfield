const MINIMUM_DEBOUNCE_MILLISECONDS = 1;
const MINIMUM_NORMALIZED_THREAD_IDENTIFIER_LENGTH = 1;
const INVALID_DEBOUNCE_MILLISECONDS_ERROR_MESSAGE =
  "PushDispatchConcurrencyCoordinator requires positive integer debounceMs";

export interface PushDispatchConcurrencyCoordinatorStatistics {
  scheduledCheckCount: number;
  startedCheckCount: number;
  completedCheckCount: number;
  failedCheckCount: number;
  skippedWhileInFlightCount: number;
  suppressedSchedulerErrorCount: number;
  activeTimerCount: number;
  inFlightThreadCount: number;
  pendingRerunThreadCount: number;
  isStopped: boolean;
}

/**
 * Owns push dispatch scheduling for completion checks with per-thread debouncing.
 * Invariant: each thread can have at most one in-flight check and one pending rerun request.
 */
export class PushDispatchConcurrencyCoordinator {
  private readonly debounceMilliseconds: number;
  private readonly shouldSchedule: () => boolean;
  private readonly runCheck: (threadId: string) => Promise<void>;
  private readonly timerByThreadId: Map<string, NodeJS.Timeout>;
  private readonly inFlightThreadIdSet: Set<string>;
  private readonly pendingRerunThreadIdSet: Set<string>;
  private scheduledCheckCount: number;
  private startedCheckCount: number;
  private completedCheckCount: number;
  private failedCheckCount: number;
  private skippedWhileInFlightCount: number;
  private suppressedSchedulerErrorCount: number;
  private isStopped: boolean;

  public constructor(
    debounceMilliseconds: number,
    shouldSchedule: () => boolean,
    runCheck: (threadId: string) => Promise<void>
  ) {
    if (
      !Number.isInteger(debounceMilliseconds) ||
      debounceMilliseconds < MINIMUM_DEBOUNCE_MILLISECONDS
    ) {
      throw new Error(INVALID_DEBOUNCE_MILLISECONDS_ERROR_MESSAGE);
    }

    this.debounceMilliseconds = debounceMilliseconds;
    this.shouldSchedule = shouldSchedule;
    this.runCheck = runCheck;
    this.timerByThreadId = new Map<string, NodeJS.Timeout>();
    this.inFlightThreadIdSet = new Set<string>();
    this.pendingRerunThreadIdSet = new Set<string>();
    this.scheduledCheckCount = 0;
    this.startedCheckCount = 0;
    this.completedCheckCount = 0;
    this.failedCheckCount = 0;
    this.skippedWhileInFlightCount = 0;
    this.suppressedSchedulerErrorCount = 0;
    this.isStopped = false;
  }

  public schedule(threadId: string): void {
    const normalizedThreadId = this.readNormalizedThreadIdentifier(threadId);
    if (normalizedThreadId === null) {
      return;
    }

    this.scheduleNormalizedThreadCheckWithSuppressedSchedulerErrors(normalizedThreadId);
  }

  public stop(): void {
    this.isStopped = true;
    for (const timer of this.timerByThreadId.values()) {
      clearTimeout(timer);
    }
    this.timerByThreadId.clear();
    this.pendingRerunThreadIdSet.clear();
  }

  public readStatistics(): PushDispatchConcurrencyCoordinatorStatistics {
    return {
      scheduledCheckCount: this.scheduledCheckCount,
      startedCheckCount: this.startedCheckCount,
      completedCheckCount: this.completedCheckCount,
      failedCheckCount: this.failedCheckCount,
      skippedWhileInFlightCount: this.skippedWhileInFlightCount,
      suppressedSchedulerErrorCount: this.suppressedSchedulerErrorCount,
      activeTimerCount: this.timerByThreadId.size,
      inFlightThreadCount: this.inFlightThreadIdSet.size,
      pendingRerunThreadCount: this.pendingRerunThreadIdSet.size,
      isStopped: this.isStopped
    };
  }

  private async executeCheck(threadId: string): Promise<void> {
    if (this.inFlightThreadIdSet.has(threadId)) {
      this.skippedWhileInFlightCount += 1;
      this.pendingRerunThreadIdSet.add(threadId);
      return;
    }

    this.inFlightThreadIdSet.add(threadId);
    this.startedCheckCount += 1;
    try {
      await this.runCheck(threadId);
      this.completedCheckCount += 1;
    } catch {
      // Check failures should not surface as unhandled rejections from scheduler-owned microtasks.
      this.failedCheckCount += 1;
    } finally {
      this.inFlightThreadIdSet.delete(threadId);

      if (this.pendingRerunThreadIdSet.delete(threadId)) {
        this.schedulePendingRerun(threadId);
      }
    }
  }

  private readNormalizedThreadIdentifier(threadId: string): string | null {
    const normalizedThreadId = threadId.trim();
    if (normalizedThreadId.length < MINIMUM_NORMALIZED_THREAD_IDENTIFIER_LENGTH) {
      return null;
    }

    return normalizedThreadId;
  }

  private scheduleNormalizedThreadCheck(threadId: string): void {
    if (!this.shouldScheduleThreadCheck()) {
      return;
    }

    this.queueDebouncedThreadCheck(threadId);
  }

  private shouldScheduleThreadCheck(): boolean {
    if (this.isStopped) {
      return false;
    }

    return this.shouldSchedule();
  }

  private queueDebouncedThreadCheck(threadId: string): void {
    const existingTimer = this.timerByThreadId.get(threadId);
    if (existingTimer !== undefined) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.timerByThreadId.delete(threadId);
      this.executeCheckWithoutUnhandledRejection(threadId);
    }, this.debounceMilliseconds);
    this.timerByThreadId.set(threadId, timer);
    this.scheduledCheckCount += 1;
  }

  private executeCheckWithoutUnhandledRejection(threadId: string): void {
    void this.executeCheck(threadId).catch(() => {
      this.recordSuppressedSchedulerError();
    });
  }

  private schedulePendingRerun(threadId: string): void {
    this.scheduleNormalizedThreadCheckWithSuppressedSchedulerErrors(threadId);
  }

  // Policy-owner callbacks can throw; scheduler ownership requires suppressing and counting these errors.
  private scheduleNormalizedThreadCheckWithSuppressedSchedulerErrors(threadId: string): void {
    try {
      this.scheduleNormalizedThreadCheck(threadId);
    } catch {
      this.recordSuppressedSchedulerError();
    }
  }

  private recordSuppressedSchedulerError(): void {
    this.suppressedSchedulerErrorCount += 1;
  }
}

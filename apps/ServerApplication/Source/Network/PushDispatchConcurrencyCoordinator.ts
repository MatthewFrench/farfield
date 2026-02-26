export interface PushDispatchConcurrencyCoordinatorStatistics {
  scheduledCheckCount: number;
  startedCheckCount: number;
  completedCheckCount: number;
  failedCheckCount: number;
  skippedWhileInFlightCount: number;
  activeTimerCount: number;
  inFlightThreadCount: number;
}

export class PushDispatchConcurrencyCoordinator {
  private readonly debounceMs: number;
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
  private isStopped: boolean;

  public constructor(
    debounceMs: number,
    shouldSchedule: () => boolean,
    runCheck: (threadId: string) => Promise<void>
  ) {
    if (!Number.isInteger(debounceMs) || debounceMs <= 0) {
      throw new Error("PushDispatchConcurrencyCoordinator requires positive integer debounceMs");
    }

    this.debounceMs = debounceMs;
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
    this.isStopped = false;
  }

  public schedule(threadId: string): void {
    if (this.isStopped) {
      return;
    }

    if (!this.shouldSchedule()) {
      return;
    }

    const normalizedThreadId = threadId.trim();
    if (normalizedThreadId.length === 0) {
      return;
    }

    const existingTimer = this.timerByThreadId.get(normalizedThreadId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.timerByThreadId.delete(normalizedThreadId);
      void this.executeCheck(normalizedThreadId);
    }, this.debounceMs);
    this.timerByThreadId.set(normalizedThreadId, timer);
    this.scheduledCheckCount += 1;
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
      activeTimerCount: this.timerByThreadId.size,
      inFlightThreadCount: this.inFlightThreadIdSet.size
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

      if (this.pendingRerunThreadIdSet.delete(threadId) && !this.isStopped) {
        this.schedule(threadId);
      }
    }
  }
}

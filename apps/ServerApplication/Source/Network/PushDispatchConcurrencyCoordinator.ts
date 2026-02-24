export interface PushDispatchConcurrencyCoordinatorStatistics {
  scheduledCheckCount: number;
  startedCheckCount: number;
  completedCheckCount: number;
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
  private scheduledCheckCount: number;
  private startedCheckCount: number;
  private completedCheckCount: number;
  private skippedWhileInFlightCount: number;

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
    this.scheduledCheckCount = 0;
    this.startedCheckCount = 0;
    this.completedCheckCount = 0;
    this.skippedWhileInFlightCount = 0;
  }

  public schedule(threadId: string): void {
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
    for (const timer of this.timerByThreadId.values()) {
      clearTimeout(timer);
    }
    this.timerByThreadId.clear();
  }

  public readStatistics(): PushDispatchConcurrencyCoordinatorStatistics {
    return {
      scheduledCheckCount: this.scheduledCheckCount,
      startedCheckCount: this.startedCheckCount,
      completedCheckCount: this.completedCheckCount,
      skippedWhileInFlightCount: this.skippedWhileInFlightCount,
      activeTimerCount: this.timerByThreadId.size,
      inFlightThreadCount: this.inFlightThreadIdSet.size
    };
  }

  private async executeCheck(threadId: string): Promise<void> {
    if (this.inFlightThreadIdSet.has(threadId)) {
      this.skippedWhileInFlightCount += 1;
      return;
    }

    this.inFlightThreadIdSet.add(threadId);
    this.startedCheckCount += 1;
    try {
      await this.runCheck(threadId);
      this.completedCheckCount += 1;
    } finally {
      this.inFlightThreadIdSet.delete(threadId);
    }
  }
}

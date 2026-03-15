/**
 * Owns thread-progress notification diagnostics contracts for debug coverage.
 */
export type DebugAppServerCoverageThreadProgressNotificationMethod =
  | "thread/compacted"
  | "thread/started"
  | "thread/tokenUsage/updated";

export interface DebugAppServerCoverageThreadProgressNotificationSummary {
  method: DebugAppServerCoverageThreadProgressNotificationMethod;
  sequence: number;
  threadId: string;
  turnId: string | null;
  modelProvider: string | null;
  preview: string | null;
  totalTokens: number | null;
  lastTotalTokens: number | null;
  modelContextWindow: number | null;
  receivedAtMilliseconds: number;
}

export interface DebugAppServerCoverageThreadProgressNotificationMethodCount {
  method: DebugAppServerCoverageThreadProgressNotificationMethod;
  count: number;
}

export interface DebugAppServerCoverageThreadProgressNotificationsResult {
  sinceSequence: number | null;
  eventCount: number;
  nextSequence: number;
  firstAvailableSequence: number;
  resetRequired: boolean;
  events: DebugAppServerCoverageThreadProgressNotificationSummary[];
  methodCounts: DebugAppServerCoverageThreadProgressNotificationMethodCount[];
  readAtIso8601: string;
}

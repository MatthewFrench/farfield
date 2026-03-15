/**
 * Owns thread-realtime notification diagnostics contracts for debug coverage.
 */
export type DebugAppServerCoverageThreadRealtimeNotificationMethod =
  | "thread/realtime/closed"
  | "thread/realtime/error"
  | "thread/realtime/itemAdded"
  | "thread/realtime/outputAudio/delta"
  | "thread/realtime/started";

export interface DebugAppServerCoverageThreadRealtimeNotificationSummary {
  method: DebugAppServerCoverageThreadRealtimeNotificationMethod;
  sequence: number;
  threadId: string;
  sessionId: string | null;
  itemPreview: string | null;
  audioDataLength: number | null;
  audioSampleRate: number | null;
  audioNumChannels: number | null;
  audioSamplesPerChannel: number | null;
  errorMessage: string | null;
  closeReason: string | null;
  receivedAtMilliseconds: number;
}

export interface DebugAppServerCoverageThreadRealtimeNotificationMethodCount {
  method: DebugAppServerCoverageThreadRealtimeNotificationMethod;
  count: number;
}

export interface DebugAppServerCoverageThreadRealtimeNotificationsResult {
  sinceSequence: number | null;
  eventCount: number;
  nextSequence: number;
  firstAvailableSequence: number;
  resetRequired: boolean;
  events: DebugAppServerCoverageThreadRealtimeNotificationSummary[];
  methodCounts: DebugAppServerCoverageThreadRealtimeNotificationMethodCount[];
  readAtIso8601: string;
}

/**
 * Owns account/app/windows notification diagnostics contracts for debug coverage.
 */
export type DebugAppServerCoverageAccountAndAppNotificationMethod =
  | "account/rateLimits/updated"
  | "account/updated"
  | "app/list/updated"
  | "windowsSandbox/setupCompleted";

export interface DebugAppServerCoverageAccountAndAppNotificationSummary {
  method: DebugAppServerCoverageAccountAndAppNotificationMethod;
  sequence: number;
  authMode: "apikey" | "chatgpt" | "chatgptAuthTokens" | null;
  rateLimitName: string | null;
  rateLimitPlanType:
    | "free"
    | "go"
    | "plus"
    | "pro"
    | "team"
    | "business"
    | "enterprise"
    | "edu"
    | "unknown"
    | null;
  appCount: number | null;
  windowsSandboxMode: "elevated" | "unelevated" | null;
  windowsSandboxSuccess: boolean | null;
  windowsSandboxError: string | null;
  receivedAtMilliseconds: number;
}

export interface DebugAppServerCoverageAccountAndAppNotificationMethodCount {
  method: DebugAppServerCoverageAccountAndAppNotificationMethod;
  count: number;
}

export interface DebugAppServerCoverageAccountAndAppNotificationsResult {
  sinceSequence: number | null;
  eventCount: number;
  nextSequence: number;
  firstAvailableSequence: number;
  resetRequired: boolean;
  events: DebugAppServerCoverageAccountAndAppNotificationSummary[];
  methodCounts: DebugAppServerCoverageAccountAndAppNotificationMethodCount[];
  readAtIso8601: string;
}

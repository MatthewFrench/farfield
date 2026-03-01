export type ThreadRuntimeStatusType = "active" | "idle" | "notLoaded" | "systemError";
export type ThreadRuntimeActiveFlag = "waitingOnApproval" | "waitingOnUserInput";

export interface ThreadRuntimeStatusSnapshot {
  sequence: number;
  statusType: ThreadRuntimeStatusType;
  activeFlags: ThreadRuntimeActiveFlag[];
  receivedAtMilliseconds: number;
}

export type ThreadRuntimeStatusByThreadIdentifier = Record<string, ThreadRuntimeStatusSnapshot>;

export type ThreadSidebarAccountPlanType =
  | "free"
  | "go"
  | "plus"
  | "pro"
  | "team"
  | "business"
  | "enterprise"
  | "edu"
  | "unknown";

export interface ThreadSidebarRateLimitSummary {
  limitId: string | null;
  planType: ThreadSidebarAccountPlanType | null;
  usedPercent: number | null;
  refreshedAtMilliseconds: number;
}

export type ThreadSidebarAccountMode = "signedOut" | "apiKey" | "chatgpt";

export interface ThreadSidebarAccountSummary {
  mode: ThreadSidebarAccountMode;
  planType: ThreadSidebarAccountPlanType | null;
  email: string | null;
  requiresOpenaiAuth: boolean;
  refreshedAtMilliseconds: number;
}

export interface ThreadSidebarAppsSummary {
  appCount: number;
  refreshedAtMilliseconds: number;
}

export interface ThreadSidebarTokenUsageSummary {
  threadId: string;
  turnId: string;
  totalTokens: number;
  lastTotalTokens: number;
  modelContextWindow: number | null;
  usedPercent: number | null;
  sequence: number;
  receivedAtMilliseconds: number;
  refreshedAtMilliseconds: number;
}

export type ThreadRuntimeProgressMethod =
  | "thread/started"
  | "thread/compacted"
  | "turn/started"
  | "turn/completed"
  | "turn/plan/updated"
  | "turn/diff/updated";

export interface ThreadRuntimeProgressSummary {
  method: ThreadRuntimeProgressMethod;
  threadId: string;
  turnId: string | null;
  preview: string | null;
  modelProvider: string | null;
  sequence: number;
  receivedAtMilliseconds: number;
  refreshedAtMilliseconds: number;
}

export type ThreadRuntimeWarningMethod =
  | "configWarning"
  | "deprecationNotice"
  | "windows/worldWritableWarning"
  | "thread/archived"
  | "thread/unarchived"
  | "thread/closed"
  | "thread/realtime/started"
  | "thread/realtime/closed"
  | "error";

export interface ThreadRuntimeWarningSummary {
  method: ThreadRuntimeWarningMethod;
  summary: string;
  threadId: string | null;
  isRetrying: boolean;
  sequence: number;
  receivedAtMilliseconds: number;
  refreshedAtMilliseconds: number;
}

export type ThreadRuntimeModelRerouteReason = "highRiskCyberActivity";

export interface ThreadRuntimeModelRerouteSummary {
  threadId: string;
  turnId: string;
  fromModel: string;
  toModel: string;
  reason: ThreadRuntimeModelRerouteReason;
  sequence: number;
  receivedAtMilliseconds: number;
  refreshedAtMilliseconds: number;
}

export interface ThreadSidebarRuntimeSummary {
  account: ThreadSidebarAccountSummary | null;
  rateLimits: ThreadSidebarRateLimitSummary | null;
  apps: ThreadSidebarAppsSummary | null;
  progress: ThreadRuntimeProgressSummary | null;
  warning: ThreadRuntimeWarningSummary | null;
  tokenUsage: ThreadSidebarTokenUsageSummary | null;
  modelReroute: ThreadRuntimeModelRerouteSummary | null;
}

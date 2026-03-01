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

export interface ThreadSidebarAppsSummary {
  appCount: number;
  refreshedAtMilliseconds: number;
}

export interface ThreadSidebarRuntimeSummary {
  rateLimits: ThreadSidebarRateLimitSummary | null;
  apps: ThreadSidebarAppsSummary | null;
}

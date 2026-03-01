/**
 * Owns thread-status value contracts used by thread-lifecycle diagnostics.
 */
export type DebugAppServerCoverageThreadStatusType =
  | "active"
  | "idle"
  | "notLoaded"
  | "systemError";

export type DebugAppServerCoverageThreadActiveFlag = "waitingOnApproval" | "waitingOnUserInput";

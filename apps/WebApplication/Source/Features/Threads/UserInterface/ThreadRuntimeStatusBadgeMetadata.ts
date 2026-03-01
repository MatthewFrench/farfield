import { type ThreadRuntimeStatusSnapshot } from "@/Features/Threads/DomainModel/ThreadRuntimeStatusContracts";

const THREAD_RUNTIME_STATUS_BADGE_LABEL_ACTIVE = "Active";
const THREAD_RUNTIME_STATUS_BADGE_LABEL_AWAITING_APPROVAL = "Awaiting approval";
const THREAD_RUNTIME_STATUS_BADGE_LABEL_AWAITING_INPUT = "Awaiting input";
const THREAD_RUNTIME_STATUS_BADGE_LABEL_IDLE = "Idle";
const THREAD_RUNTIME_STATUS_BADGE_LABEL_NOT_LOADED = "Not loaded";
const THREAD_RUNTIME_STATUS_BADGE_LABEL_SYSTEM_ERROR = "Error";
const THREAD_RUNTIME_STATUS_BADGE_CLASSES_ACTIVE =
  "bg-emerald-500/15 text-emerald-300 border border-emerald-400/30";
const THREAD_RUNTIME_STATUS_BADGE_CLASSES_AWAITING =
  "bg-amber-500/15 text-amber-300 border border-amber-400/30";
const THREAD_RUNTIME_STATUS_BADGE_CLASSES_IDLE =
  "bg-muted/70 text-muted-foreground border border-border/70";
const THREAD_RUNTIME_STATUS_BADGE_CLASSES_NOT_LOADED =
  "bg-slate-500/15 text-slate-300 border border-slate-400/30";
const THREAD_RUNTIME_STATUS_BADGE_CLASSES_SYSTEM_ERROR =
  "bg-rose-500/15 text-rose-300 border border-rose-400/30";
const THREAD_RUNTIME_STATUS_TITLE_NOT_OBSERVED = "Runtime status has not been observed yet";

function isAwaitingApproval(status: ThreadRuntimeStatusSnapshot): boolean {
  return status.activeFlags.includes("waitingOnApproval");
}

function isAwaitingInput(status: ThreadRuntimeStatusSnapshot): boolean {
  return status.activeFlags.includes("waitingOnUserInput");
}

export function readThreadRuntimeStatusBadgeLabel(
  status: ThreadRuntimeStatusSnapshot | undefined,
): string {
  if (status === undefined) {
    return THREAD_RUNTIME_STATUS_BADGE_LABEL_NOT_LOADED;
  }

  if (status.statusType === "active") {
    if (isAwaitingApproval(status)) {
      return THREAD_RUNTIME_STATUS_BADGE_LABEL_AWAITING_APPROVAL;
    }
    if (isAwaitingInput(status)) {
      return THREAD_RUNTIME_STATUS_BADGE_LABEL_AWAITING_INPUT;
    }
    return THREAD_RUNTIME_STATUS_BADGE_LABEL_ACTIVE;
  }

  if (status.statusType === "idle") {
    return THREAD_RUNTIME_STATUS_BADGE_LABEL_IDLE;
  }

  if (status.statusType === "systemError") {
    return THREAD_RUNTIME_STATUS_BADGE_LABEL_SYSTEM_ERROR;
  }

  return THREAD_RUNTIME_STATUS_BADGE_LABEL_NOT_LOADED;
}

export function readThreadRuntimeStatusBadgeClasses(
  status: ThreadRuntimeStatusSnapshot | undefined,
): string {
  if (status === undefined) {
    return THREAD_RUNTIME_STATUS_BADGE_CLASSES_NOT_LOADED;
  }

  if (status.statusType === "active") {
    if (isAwaitingApproval(status) || isAwaitingInput(status)) {
      return THREAD_RUNTIME_STATUS_BADGE_CLASSES_AWAITING;
    }
    return THREAD_RUNTIME_STATUS_BADGE_CLASSES_ACTIVE;
  }

  if (status.statusType === "idle") {
    return THREAD_RUNTIME_STATUS_BADGE_CLASSES_IDLE;
  }

  if (status.statusType === "systemError") {
    return THREAD_RUNTIME_STATUS_BADGE_CLASSES_SYSTEM_ERROR;
  }

  return THREAD_RUNTIME_STATUS_BADGE_CLASSES_NOT_LOADED;
}

export function readThreadRuntimeStatusBadgeTitle(
  status: ThreadRuntimeStatusSnapshot | undefined,
): string {
  if (status === undefined) {
    return THREAD_RUNTIME_STATUS_TITLE_NOT_OBSERVED;
  }
  return `Runtime status at sequence ${String(status.sequence)}`;
}

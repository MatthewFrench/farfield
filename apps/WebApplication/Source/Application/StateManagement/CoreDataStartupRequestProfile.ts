export type StartupRequestTier = "critical" | "deferred";

export interface StartupRequestProfileEntry {
  actionName: string;
  tier: StartupRequestTier;
  description: string;
}

export const STARTUP_CRITICAL_EVENTS_SESSION_OPERATION = "startup-critical.events-session";
export const STARTUP_CRITICAL_THREADS_OPERATION = "startup-critical.threads.active";
export const STARTUP_DEFERRED_THREADS_REVALIDATE_OPERATION = "startup-deferred.threads.active.revalidate";
export const STARTUP_DEFERRED_HEALTH_OPERATION = "startup-deferred.health";
export const STARTUP_DEFERRED_AGENTS_OPERATION = "startup-deferred.agents";
export const STARTUP_DEFERRED_TRACE_STATUS_OPERATION = "startup-deferred.trace-status";
export const STARTUP_DEFERRED_MODES_OPERATION = "startup-deferred.capabilities.modes";
export const STARTUP_DEFERRED_MODELS_OPERATION = "startup-deferred.capabilities.models";
export const STARTUP_DEFERRED_DEFAULTS_OPERATION = "startup-deferred.capabilities.defaults";
export const STARTUP_DEFERRED_DEBUG_HISTORY_OPERATION = "startup-deferred.debug.history";
export const STARTUP_DEFERRED_DEBUG_ERRORS_OPERATION = "startup-deferred.debug.client-errors";

export const STARTUP_REQUEST_PROFILE: StartupRequestProfileEntry[] = [
  {
    actionName: STARTUP_CRITICAL_EVENTS_SESSION_OPERATION,
    tier: "critical",
    description: "Bootstrap API session/auth gate"
  },
  {
    actionName: STARTUP_CRITICAL_THREADS_OPERATION,
    tier: "critical",
    description: "Load active thread list for sidebar"
  },
  {
    actionName: STARTUP_DEFERRED_HEALTH_OPERATION,
    tier: "deferred",
    description: "Load runtime health snapshot"
  },
  {
    actionName: STARTUP_DEFERRED_AGENTS_OPERATION,
    tier: "deferred",
    description: "Load available agent descriptors"
  },
  {
    actionName: STARTUP_DEFERRED_TRACE_STATUS_OPERATION,
    tier: "deferred",
    description: "Load trace status for debug workspace"
  },
  {
    actionName: STARTUP_DEFERRED_MODES_OPERATION,
    tier: "deferred",
    description: "Load collaboration mode options"
  },
  {
    actionName: STARTUP_DEFERRED_MODELS_OPERATION,
    tier: "deferred",
    description: "Load model catalog options"
  },
  {
    actionName: STARTUP_DEFERRED_DEFAULTS_OPERATION,
    tier: "deferred",
    description: "Load default model/reasoning values"
  },
  {
    actionName: STARTUP_DEFERRED_DEBUG_HISTORY_OPERATION,
    tier: "deferred",
    description: "Load debug history list"
  },
  {
    actionName: STARTUP_DEFERRED_DEBUG_ERRORS_OPERATION,
    tier: "deferred",
    description: "Load debug client error list"
  },
  {
    actionName: STARTUP_DEFERRED_THREADS_REVALIDATE_OPERATION,
    tier: "deferred",
    description: "Revalidate active thread list from network"
  }
];

export const STARTUP_CRITICAL_REQUEST_BUDGET_MAXIMUM = 2;

export function isStartupActionName(actionName: string): boolean {
  return STARTUP_REQUEST_PROFILE.some((entry) => entry.actionName === actionName);
}

export function readStartupRequestDescription(actionName: string): string {
  const matchingProfileEntry = STARTUP_REQUEST_PROFILE.find((entry) => entry.actionName === actionName);
  return matchingProfileEntry?.description ?? actionName;
}

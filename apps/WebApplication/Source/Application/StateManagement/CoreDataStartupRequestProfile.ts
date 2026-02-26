export type StartupRequestTier = "critical" | "deferred";

export interface StartupRequestProfileEntry {
  actionName: string;
  tier: StartupRequestTier;
  description: string;
}

const STARTUP_REQUEST_PROFILE_DUPLICATE_ACTION_NAME_ERROR_PREFIX =
  "Startup request profile contains duplicate action name: ";

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

/**
 * Startup request ownership contract:
 * each action name must be unique so metrics and observability labels remain deterministic.
 */
export const STARTUP_REQUEST_PROFILE: readonly StartupRequestProfileEntry[] = [
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

const STARTUP_ACTION_NAME_SET = new Set<string>();
const STARTUP_REQUEST_DESCRIPTION_BY_ACTION_NAME = new Map<string, string>();

for (const startupRequestProfileEntry of STARTUP_REQUEST_PROFILE) {
  if (STARTUP_ACTION_NAME_SET.has(startupRequestProfileEntry.actionName)) {
    throw new Error(
      `${STARTUP_REQUEST_PROFILE_DUPLICATE_ACTION_NAME_ERROR_PREFIX}${startupRequestProfileEntry.actionName}`
    );
  }
  STARTUP_ACTION_NAME_SET.add(startupRequestProfileEntry.actionName);
  STARTUP_REQUEST_DESCRIPTION_BY_ACTION_NAME.set(
    startupRequestProfileEntry.actionName,
    startupRequestProfileEntry.description
  );
}

export function isStartupActionName(actionName: string): boolean {
  return STARTUP_ACTION_NAME_SET.has(actionName);
}

export function readStartupRequestDescription(actionName: string): string {
  return STARTUP_REQUEST_DESCRIPTION_BY_ACTION_NAME.get(actionName) ?? actionName;
}

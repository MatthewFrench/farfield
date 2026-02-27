const STARTUP_ACTION_NAME_PREFIX = "startup-";

const STARTUP_ACTION_DESCRIPTION_BY_NAME: Readonly<Record<string, string>> = {
  "startup-critical.events-session": "Bootstrap API session/auth gate",
  "startup-critical.threads.active": "Load active thread list for sidebar",
  "startup-deferred.health": "Load runtime health snapshot",
  "startup-deferred.agents": "Load available agent descriptors",
  "startup-deferred.trace-status": "Load trace status for debug workspace",
  "startup-deferred.capabilities.modes": "Load collaboration mode options",
  "startup-deferred.capabilities.models": "Load model catalog options",
  "startup-deferred.capabilities.defaults": "Load default model/reasoning values",
  "startup-deferred.debug.history": "Load debug history list",
  "startup-deferred.debug.client-errors": "Load debug client error list",
  "startup-deferred.threads.active.revalidate": "Revalidate active thread list from network",
};

/**
 * Owns startup-action labels and summaries used by request observability lifecycle reporting.
 */
export function isStartupActionName(actionName: string | null): actionName is string {
  if (actionName === null) {
    return false;
  }
  return actionName.startsWith(STARTUP_ACTION_NAME_PREFIX);
}

export function readStartupActionDescription(actionName: string): string {
  return STARTUP_ACTION_DESCRIPTION_BY_NAME[actionName] ?? actionName;
}

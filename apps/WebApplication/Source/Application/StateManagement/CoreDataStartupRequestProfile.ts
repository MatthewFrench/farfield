import { z } from "zod";

export type StartupRequestTier = "critical" | "deferred";

export interface StartupRequestProfileEntry {
  actionName: string;
  tier: StartupRequestTier;
  description: string;
}

export const STARTUP_REQUEST_ALLOWED_TIERS = ["critical", "deferred"] as const;

const STARTUP_REQUEST_PROFILE_DUPLICATE_ACTION_NAME_ERROR_PREFIX =
  "Startup request profile contains duplicate action name: ";
const STARTUP_REQUEST_PROFILE_ACTION_NAME_EMPTY_ERROR_PREFIX =
  "Startup request profile contains empty action name at entry index: ";
const STARTUP_REQUEST_PROFILE_ENTRY_UNDEFINED_ERROR_PREFIX =
  "Startup request profile contains undefined entry at index: ";
const STARTUP_REQUEST_PROFILE_DESCRIPTION_EMPTY_ERROR_PREFIX =
  "Startup request profile contains empty description for action name: ";
const STARTUP_REQUEST_PROFILE_DISALLOWED_TIER_ERROR_PREFIX =
  "Startup request profile contains disallowed tier for action name: ";
const STARTUP_REQUEST_PROFILE_SCHEMA_ERROR_PREFIX = "Startup request profile schema validation failed";
const STARTUP_REQUEST_PROFILE_CRITICAL_BUDGET_ERROR_PREFIX =
  "Startup request profile critical request count exceeds budget maximum: ";

const StartupRequestProfileEntrySchema = z.object({
  actionName: z.string(),
  tier: z.enum(STARTUP_REQUEST_ALLOWED_TIERS),
  description: z.string()
}).strict();

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
const STARTUP_REQUEST_ALLOWED_TIER_SET = new Set<StartupRequestTier>(STARTUP_REQUEST_ALLOWED_TIERS);

interface StartupRequestProfileOwnerState {
  actionNameSet: ReadonlySet<string>;
  requestDescriptionByActionName: ReadonlyMap<string, string>;
}

function readStartupRequestProfileSchemaError(entryIndex: number, error: z.ZodError): Error {
  const issueMessages = error.issues.map((issue) => issue.message).join(", ");
  const profileSchemaErrorMessage =
    `${STARTUP_REQUEST_PROFILE_SCHEMA_ERROR_PREFIX} at entry index ${String(entryIndex)}: ${issueMessages}`;
  return new Error(profileSchemaErrorMessage);
}

function parseStartupRequestProfileEntry(
  entry: StartupRequestProfileEntry,
  entryIndex: number
): StartupRequestProfileEntry {
  const parseResult = StartupRequestProfileEntrySchema.safeParse(entry);
  if (!parseResult.success) {
    throw readStartupRequestProfileSchemaError(entryIndex, parseResult.error);
  }
  return parseResult.data;
}

function initializeStartupRequestProfileOwnerState(
  startupRequestProfileEntries: readonly StartupRequestProfileEntry[]
): StartupRequestProfileOwnerState {
  const actionNameSet = new Set<string>();
  const requestDescriptionByActionName = new Map<string, string>();
  let criticalRequestCount = 0;

  for (let profileEntryIndex = 0; profileEntryIndex < startupRequestProfileEntries.length; profileEntryIndex += 1) {
    const rawStartupRequestProfileEntry = startupRequestProfileEntries[profileEntryIndex];
    if (rawStartupRequestProfileEntry === undefined) {
      throw new Error(
        `${STARTUP_REQUEST_PROFILE_ENTRY_UNDEFINED_ERROR_PREFIX}${String(profileEntryIndex)}`
      );
    }
    const startupRequestProfileEntry = parseStartupRequestProfileEntry(
      rawStartupRequestProfileEntry,
      profileEntryIndex
    );
    if (startupRequestProfileEntry.actionName.trim().length === 0) {
      throw new Error(
        `${STARTUP_REQUEST_PROFILE_ACTION_NAME_EMPTY_ERROR_PREFIX}${String(profileEntryIndex)}`
      );
    }
    if (!STARTUP_REQUEST_ALLOWED_TIER_SET.has(startupRequestProfileEntry.tier)) {
      throw new Error(
        `${STARTUP_REQUEST_PROFILE_DISALLOWED_TIER_ERROR_PREFIX}${startupRequestProfileEntry.actionName} (${startupRequestProfileEntry.tier})`
      );
    }
    if (startupRequestProfileEntry.description.trim().length === 0) {
      throw new Error(
        `${STARTUP_REQUEST_PROFILE_DESCRIPTION_EMPTY_ERROR_PREFIX}${startupRequestProfileEntry.actionName}`
      );
    }
    if (actionNameSet.has(startupRequestProfileEntry.actionName)) {
      throw new Error(
        `${STARTUP_REQUEST_PROFILE_DUPLICATE_ACTION_NAME_ERROR_PREFIX}${startupRequestProfileEntry.actionName}`
      );
    }
    actionNameSet.add(startupRequestProfileEntry.actionName);
    requestDescriptionByActionName.set(
      startupRequestProfileEntry.actionName,
      startupRequestProfileEntry.description
    );
    if (startupRequestProfileEntry.tier === "critical") {
      criticalRequestCount += 1;
    }
  }

  if (criticalRequestCount > STARTUP_CRITICAL_REQUEST_BUDGET_MAXIMUM) {
    throw new Error(
      `${STARTUP_REQUEST_PROFILE_CRITICAL_BUDGET_ERROR_PREFIX}${String(criticalRequestCount)} > ${String(STARTUP_CRITICAL_REQUEST_BUDGET_MAXIMUM)}`
    );
  }

  return {
    actionNameSet,
    requestDescriptionByActionName
  };
}

const STARTUP_REQUEST_PROFILE_OWNER_STATE = initializeStartupRequestProfileOwnerState(STARTUP_REQUEST_PROFILE);

export function isStartupActionName(actionName: string): boolean {
  return STARTUP_REQUEST_PROFILE_OWNER_STATE.actionNameSet.has(actionName);
}

export function readStartupRequestDescription(actionName: string): string {
  return STARTUP_REQUEST_PROFILE_OWNER_STATE.requestDescriptionByActionName.get(actionName) ?? actionName;
}

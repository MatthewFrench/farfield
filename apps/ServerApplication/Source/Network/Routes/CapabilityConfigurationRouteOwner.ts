import { AppServerReasoningEffortSchema } from "@farfield/protocol";
import { z } from "zod";
import type {
  AgentConfigDefaults,
  AgentId,
  AgentReadConfigRequirementsResult,
} from "../../Agents/Types.js";
import { logger } from "../../Shared/Logging/Logger.js";
import {
  type CapabilityRouteDependencies,
  CapabilityRouteErrorMessagePrefixByName,
  CapabilityRouteLogEventByName,
  CapabilityRouteMethodByName,
  CapabilityRoutePathnameByName,
  CapabilityRouteQueryParameterByName,
  CapabilityRouteStatusCodeByName,
  CapabilityRouteTimeoutLabelByName,
  isCapabilityRouteRequest,
  toErrorMessage,
} from "./CapabilityRouteContracts.js";

type CapabilityReasoningEffort = z.infer<typeof AppServerReasoningEffortSchema>;

interface CapabilityDefaultsResponseBody {
  ok: true;
  agentId: AgentId | null;
  model: string | null;
  reasoningEffort: CapabilityReasoningEffort | null;
}

interface CapabilityConfigRequirementsResponseBody {
  ok: true;
  requirements: AgentReadConfigRequirementsResult["requirements"];
}

function readRequestedAgentIdOrRespondBadRequest(
  deps: CapabilityRouteDependencies,
): AgentId | null | undefined {
  const requestedAgentRaw = deps.url.searchParams.get(CapabilityRouteQueryParameterByName.agentId);
  const requestedAgentId = deps.parseAgentId(requestedAgentRaw);
  if (requestedAgentRaw !== null && requestedAgentRaw.length > 0 && requestedAgentId === null) {
    deps.jsonResponse(deps.res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.invalidAgentId}${requestedAgentRaw}`,
    });
    return undefined;
  }
  return requestedAgentId;
}

function parseReasoningEffort(value: string | null): CapabilityReasoningEffort | null {
  if (value === null) {
    return null;
  }
  const parsedReasoningEffort = AppServerReasoningEffortSchema.safeParse(value);
  return parsedReasoningEffort.success ? parsedReasoningEffort.data : null;
}

function mapDefaultsResponse(
  agentId: AgentId | null,
  defaults: AgentConfigDefaults | null,
): CapabilityDefaultsResponseBody {
  if (agentId === null || defaults === null) {
    return {
      ok: true,
      agentId,
      model: null,
      reasoningEffort: null,
    };
  }

  const normalizedReasoningEffort = parseReasoningEffort(defaults.reasoningEffort);
  if (defaults.reasoningEffort !== null && normalizedReasoningEffort === null) {
    logger.warn(
      {
        agentId,
        reasoningEffort: defaults.reasoningEffort,
      },
      CapabilityRouteLogEventByName.defaultsInvalidReasoningEffort,
    );
  }

  return {
    ok: true,
    agentId,
    model: defaults.model,
    reasoningEffort: normalizedReasoningEffort,
  };
}

function mapConfigRequirementsResponse(
  result: AgentReadConfigRequirementsResult,
): CapabilityConfigRequirementsResponseBody {
  return {
    ok: true,
    requirements: result.requirements,
  };
}

async function handleConfigDefaultsRoute(deps: CapabilityRouteDependencies): Promise<boolean> {
  if (
    !isCapabilityRouteRequest(
      deps.req.method,
      deps.pathname,
      CapabilityRouteMethodByName.get,
      CapabilityRoutePathnameByName.defaults,
    )
  ) {
    return false;
  }

  const requestedAgentId = readRequestedAgentIdOrRespondBadRequest(deps);
  if (requestedAgentId === undefined) {
    return true;
  }

  const resolvedAgentId = requestedAgentId ?? deps.registry.resolveDefaultAgentId();
  if (resolvedAgentId === null) {
    deps.jsonResponse(
      deps.res,
      CapabilityRouteStatusCodeByName.success,
      mapDefaultsResponse(null, null),
    );
    return true;
  }

  const adapter = deps.registry.getAdapter(resolvedAgentId);
  if (!adapter || !adapter.isEnabled() || !adapter.readConfigDefaults) {
    deps.jsonResponse(
      deps.res,
      CapabilityRouteStatusCodeByName.success,
      mapDefaultsResponse(resolvedAgentId, null),
    );
    return true;
  }

  try {
    const defaults = await adapter.readConfigDefaults();
    deps.jsonResponse(
      deps.res,
      CapabilityRouteStatusCodeByName.success,
      mapDefaultsResponse(resolvedAgentId, defaults),
    );
  } catch (error) {
    logger.warn(
      {
        agentId: resolvedAgentId,
        error: toErrorMessage(error),
      },
      CapabilityRouteLogEventByName.defaultsReadFailed,
    );
    deps.jsonResponse(
      deps.res,
      CapabilityRouteStatusCodeByName.success,
      mapDefaultsResponse(resolvedAgentId, null),
    );
  }

  return true;
}

async function handleConfigRequirementsRoute(deps: CapabilityRouteDependencies): Promise<boolean> {
  if (
    !isCapabilityRouteRequest(
      deps.req.method,
      deps.pathname,
      CapabilityRouteMethodByName.get,
      CapabilityRoutePathnameByName.configRequirements,
    )
  ) {
    return false;
  }

  const requestedAgentId = readRequestedAgentIdOrRespondBadRequest(deps);
  if (requestedAgentId === undefined) {
    return true;
  }

  const resolvedAgentId = requestedAgentId ?? deps.registry.resolveDefaultAgentId();
  if (resolvedAgentId === null) {
    deps.jsonResponse(deps.res, CapabilityRouteStatusCodeByName.success, {
      ok: true,
      requirements: null,
    });
    return true;
  }

  const adapter = deps.registry.getAdapter(resolvedAgentId);
  if (
    !adapter ||
    !adapter.isEnabled() ||
    !adapter.capabilities.canReadConfigRequirements ||
    !adapter.readConfigRequirements
  ) {
    deps.jsonResponse(deps.res, CapabilityRouteStatusCodeByName.success, {
      ok: true,
      requirements: null,
    });
    return true;
  }

  try {
    const result = await deps.withTimeout(
      adapter.readConfigRequirements({}),
      deps.capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.configRequirementsRead,
    );
    deps.jsonResponse(
      deps.res,
      CapabilityRouteStatusCodeByName.success,
      mapConfigRequirementsResponse(result),
    );
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        agentId: resolvedAgentId,
        error: message,
      },
      CapabilityRouteLogEventByName.configRequirementsReadFailed,
    );
    deps.jsonResponse(deps.res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToReadConfigRequirements}${message}`,
    });
  }

  return true;
}

/**
 * Owns configuration capability route dispatch for low-churn configuration reads.
 * Mutation routes remain in the main capability owner until their dedicated extraction lands.
 */
export async function handleCapabilityConfigurationRoutes(
  deps: CapabilityRouteDependencies,
): Promise<boolean> {
  if (await handleConfigDefaultsRoute(deps)) {
    return true;
  }
  if (await handleConfigRequirementsRoute(deps)) {
    return true;
  }
  return false;
}

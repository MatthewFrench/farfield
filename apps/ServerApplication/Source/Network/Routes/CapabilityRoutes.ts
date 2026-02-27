import type { IncomingMessage, ServerResponse } from "node:http";
import {
  AppServerCollaborationModeListItemSchema,
  type AppServerCollaborationModeListResponse,
  type AppServerListModelsResponse,
  AppServerModelSchema,
  AppServerReasoningEffortSchema,
} from "@farfield/protocol";
import type { z } from "zod";
import type { AgentRegistry } from "../../Agents/Registry.js";
import type { AgentConfigDefaults, AgentId } from "../../Agents/Types.js";
import { logger } from "../../Shared/Logging/Logger.js";

const CapabilityRouteMethodByName = {
  get: "GET",
} as const;

const CapabilityRoutePathnameByName = {
  defaults: "/api/config/defaults",
  models: "/api/models",
  collaborationModes: "/api/collaboration-modes",
} as const;

const CapabilityRouteStatusCodeByName = {
  success: 200,
  badRequest: 400,
  serviceUnavailable: 503,
} as const;

const CapabilityRouteQueryParameterByName = {
  agentId: "agentId",
  limit: "limit",
} as const;

const CapabilityRouteLogEventByName = {
  defaultsReadFailed: "agent-config-defaults-read-failed",
  defaultsInvalidReasoningEffort: "agent-config-defaults-invalid-reasoning-effort",
  modelsListTimeout: "models-list-timeout",
  collaborationModesListTimeout: "collaboration-modes-list-timeout",
} as const;

const CapabilityRouteErrorMessagePrefixByName = {
  invalidAgentId: "Invalid agentId: ",
  failedToListModels: "Failed to list models: ",
  failedToListCollaborationModes: "Failed to list collaboration modes: ",
} as const;

const CapabilityRouteTimeoutLabelByName = {
  modelsList: "models listing",
  collaborationModesList: "collaboration modes listing",
} as const;

const CapabilityRouteModelsLimitDefault = 100;

type CapabilityReasoningEffort = z.infer<typeof AppServerReasoningEffortSchema>;
type CapabilityModel = z.infer<typeof AppServerModelSchema>;
type CapabilityCollaborationMode = z.infer<typeof AppServerCollaborationModeListItemSchema>;

interface CapabilityDefaultsResponseBody {
  ok: true;
  agentId: AgentId | null;
  model: string | null;
  reasoningEffort: CapabilityReasoningEffort | null;
}

type CapabilityModelsResponseBody = AppServerListModelsResponse & {
  ok: true;
  data: CapabilityModel[];
  nextCursor: string | null;
};

type CapabilityCollaborationModesResponseBody = AppServerCollaborationModeListResponse & {
  ok: true;
  data: CapabilityCollaborationMode[];
};

function toErrorMessage<ErrorType>(error: ErrorType): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}

function isCapabilityRouteRequest(
  method: string | undefined,
  pathname: string,
  expectedPathname: string,
): boolean {
  return method === CapabilityRouteMethodByName.get && pathname === expectedPathname;
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

function mapModelsResponse(result: AppServerListModelsResponse): CapabilityModelsResponseBody {
  return {
    ok: true,
    ...result,
    nextCursor: result.nextCursor ?? null,
  };
}

function mapCollaborationModesResponse(
  result: AppServerCollaborationModeListResponse,
): CapabilityCollaborationModesResponseBody {
  return {
    ok: true,
    ...result,
  };
}

export interface CapabilityRouteDependencies {
  req: IncomingMessage;
  res: ServerResponse;
  pathname: string;
  url: URL;
  capabilityListTimeoutMs: number;
  registry: AgentRegistry;
  parseInteger: (value: string | null, defaultValue: number) => number;
  parseAgentId: (value: string | null) => AgentId | null;
  withTimeout: <T>(promise: Promise<T>, timeoutMs: number, label: string) => Promise<T>;
  jsonResponse: (res: ServerResponse, statusCode: number, body: object) => void;
}

async function handleConfigDefaultsRoute(deps: CapabilityRouteDependencies): Promise<boolean> {
  const { req, res, pathname, url, registry, parseAgentId, jsonResponse } = deps;

  if (!isCapabilityRouteRequest(req.method, pathname, CapabilityRoutePathnameByName.defaults)) {
    return false;
  }

  const requestedAgentRaw = url.searchParams.get(CapabilityRouteQueryParameterByName.agentId);
  const requestedAgentId = parseAgentId(requestedAgentRaw);
  if (requestedAgentRaw !== null && requestedAgentRaw.length > 0 && requestedAgentId === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.invalidAgentId}${requestedAgentRaw}`,
    });
    return true;
  }

  const resolvedAgentId = requestedAgentId ?? registry.resolveDefaultAgentId();
  if (resolvedAgentId === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.success, mapDefaultsResponse(null, null));
    return true;
  }

  const adapter = registry.getAdapter(resolvedAgentId);
  if (!adapter || !adapter.isEnabled() || !adapter.readConfigDefaults) {
    jsonResponse(
      res,
      CapabilityRouteStatusCodeByName.success,
      mapDefaultsResponse(resolvedAgentId, null),
    );
    return true;
  }

  try {
    const defaults = await adapter.readConfigDefaults();
    jsonResponse(
      res,
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
    jsonResponse(
      res,
      CapabilityRouteStatusCodeByName.success,
      mapDefaultsResponse(resolvedAgentId, null),
    );
  }
  return true;
}

async function handleModelsRoute(deps: CapabilityRouteDependencies): Promise<boolean> {
  const {
    req,
    res,
    pathname,
    url,
    capabilityListTimeoutMs,
    registry,
    parseInteger,
    withTimeout,
    jsonResponse,
  } = deps;

  if (!isCapabilityRouteRequest(req.method, pathname, CapabilityRoutePathnameByName.models)) {
    return false;
  }

  const adapter = registry.resolveFirstWithCapability("canListModels");
  if (!adapter || !adapter.listModels) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.success, {
      ok: true,
      data: [],
      nextCursor: null,
    });
    return true;
  }

  const limit = parseInteger(
    url.searchParams.get(CapabilityRouteQueryParameterByName.limit),
    CapabilityRouteModelsLimitDefault,
  );
  try {
    const result = await withTimeout(
      adapter.listModels(limit),
      capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.modelsList,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.success, mapModelsResponse(result));
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        error: message,
      },
      CapabilityRouteLogEventByName.modelsListTimeout,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToListModels}${message}`,
    });
  }
  return true;
}

async function handleCollaborationModesRoute(deps: CapabilityRouteDependencies): Promise<boolean> {
  const { req, res, pathname, capabilityListTimeoutMs, registry, withTimeout, jsonResponse } = deps;

  if (
    !isCapabilityRouteRequest(
      req.method,
      pathname,
      CapabilityRoutePathnameByName.collaborationModes,
    )
  ) {
    return false;
  }

  const adapter = registry.resolveFirstWithCapability("canListCollaborationModes");
  if (!adapter || !adapter.listCollaborationModes) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.success, {
      ok: true,
      data: [],
    });
    return true;
  }

  try {
    const result = await withTimeout(
      adapter.listCollaborationModes(),
      capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.collaborationModesList,
    );
    jsonResponse(
      res,
      CapabilityRouteStatusCodeByName.success,
      mapCollaborationModesResponse(result),
    );
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        error: message,
      },
      CapabilityRouteLogEventByName.collaborationModesListTimeout,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToListCollaborationModes}${message}`,
    });
  }
  return true;
}

/**
 * Owns `/api/config/defaults`, `/api/models`, and `/api/collaboration-modes`
 * route dispatch with explicit adapter-to-response mapping.
 */
export async function handleCapabilityRoutes(deps: CapabilityRouteDependencies): Promise<boolean> {
  if (await handleConfigDefaultsRoute(deps)) {
    return true;
  }
  if (await handleModelsRoute(deps)) {
    return true;
  }
  if (await handleCollaborationModesRoute(deps)) {
    return true;
  }

  return false;
}

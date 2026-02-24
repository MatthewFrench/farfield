import type { IncomingMessage, ServerResponse } from "node:http";
import { logger } from "../../Shared/Logging/Logger.js";
import type { AgentId } from "../../Agents/Types.js";
import type { AgentRegistry } from "../../Agents/Registry.js";

function toErrorMessage<ErrorType>(error: ErrorType): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
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

export async function handleCapabilityRoutes(deps: CapabilityRouteDependencies): Promise<boolean> {
  const {
    req,
    res,
    pathname,
    url,
    capabilityListTimeoutMs,
    registry,
    parseInteger,
    parseAgentId,
    withTimeout,
    jsonResponse
  } = deps;

  if (req.method === "GET" && pathname === "/api/config/defaults") {
    const requestedAgentRaw = url.searchParams.get("agentId");
    const requestedAgentId = parseAgentId(requestedAgentRaw);
    if (requestedAgentRaw && !requestedAgentId) {
      jsonResponse(res, 400, {
        ok: false,
        error: `Invalid agentId: ${requestedAgentRaw}`
      });
      return true;
    }

    const resolvedAgentId = requestedAgentId ?? registry.resolveDefaultAgentId();
    if (!resolvedAgentId) {
      jsonResponse(res, 200, {
        ok: true,
        agentId: null,
        model: null,
        reasoningEffort: null
      });
      return true;
    }

    const adapter = registry.getAdapter(resolvedAgentId);
    if (!adapter || !adapter.isEnabled() || !adapter.readConfigDefaults) {
      jsonResponse(res, 200, {
        ok: true,
        agentId: resolvedAgentId,
        model: null,
        reasoningEffort: null
      });
      return true;
    }

    try {
      const defaults = await adapter.readConfigDefaults();
      jsonResponse(res, 200, {
        ok: true,
        agentId: resolvedAgentId,
        model: defaults.model,
        reasoningEffort: defaults.reasoningEffort
      });
    } catch (error) {
      logger.warn(
        {
          agentId: resolvedAgentId,
          error: toErrorMessage(error)
        },
        "agent-config-defaults-read-failed"
      );
      jsonResponse(res, 200, {
        ok: true,
        agentId: resolvedAgentId,
        model: null,
        reasoningEffort: null
      });
    }
    return true;
  }

  if (req.method === "GET" && pathname === "/api/models") {
    const adapter = registry.resolveFirstWithCapability("canListModels");
    if (!adapter || !adapter.listModels) {
      jsonResponse(res, 200, {
        ok: true,
        data: [],
        nextCursor: null
      });
      return true;
    }

    const limit = parseInteger(url.searchParams.get("limit"), 100);
    try {
      const result = await withTimeout(
        adapter.listModels(limit),
        capabilityListTimeoutMs,
        "models listing"
      );
      jsonResponse(res, 200, { ok: true, ...result });
    } catch (error) {
      const message = toErrorMessage(error);
      logger.warn(
        {
          error: message
        },
        "models-list-timeout"
      );
      jsonResponse(res, 503, {
        ok: false,
        error: `Failed to list models: ${message}`
      });
    }
    return true;
  }

  if (req.method === "GET" && pathname === "/api/collaboration-modes") {
    const adapter = registry.resolveFirstWithCapability("canListCollaborationModes");
    if (!adapter || !adapter.listCollaborationModes) {
      jsonResponse(res, 200, {
        ok: true,
        data: []
      });
      return true;
    }

    try {
      const result = await withTimeout(
        adapter.listCollaborationModes(),
        capabilityListTimeoutMs,
        "collaboration modes listing"
      );
      jsonResponse(res, 200, { ok: true, ...result });
    } catch (error) {
      const message = toErrorMessage(error);
      logger.warn(
        {
          error: message
        },
        "collaboration-modes-list-timeout"
      );
      jsonResponse(res, 503, {
        ok: false,
        error: `Failed to list collaboration modes: ${message}`
      });
    }
    return true;
  }

  return false;
}

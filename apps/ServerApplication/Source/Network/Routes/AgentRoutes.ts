import type { IncomingMessage, ServerResponse } from "node:http";
import { logger } from "../../Logger.js";
import type { AgentRegistry } from "../../Agents/Registry.js";
import type { AgentAdapter, AgentDescriptor, AgentId } from "../../Agents/Types.js";

export interface AgentRouteDependencies {
  req: IncomingMessage;
  res: ServerResponse;
  pathname: string;
  registry: AgentRegistry;
  configuredAgentIds: AgentId[];
  buildAgentDescriptor: (adapter: AgentAdapter, projectDirectories: string[]) => AgentDescriptor;
  jsonResponse: (res: ServerResponse, statusCode: number, body: object) => void;
}

export async function handleAgentRoutes(deps: AgentRouteDependencies): Promise<boolean> {
  const {
    req,
    res,
    pathname,
    registry,
    configuredAgentIds,
    buildAgentDescriptor,
    jsonResponse
  } = deps;

  if (!(req.method === "GET" && pathname === "/api/agents")) {
    return false;
  }

  const descriptors = await Promise.all(
    registry.listAdapters().map(async (adapter) => {
      if (!adapter.listProjectDirectories || !adapter.isConnected()) {
        return buildAgentDescriptor(adapter, []);
      }

      try {
        const projectDirectories = await adapter.listProjectDirectories();
        return buildAgentDescriptor(adapter, projectDirectories);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn(
          {
            agentId: adapter.id,
            error: errorMessage
          },
          "agent-project-directory-list-failed"
        );
        return buildAgentDescriptor(adapter, []);
      }
    })
  );

  const defaultAgentId = registry.resolveDefaultAgentId() ?? configuredAgentIds[0];

  jsonResponse(res, 200, {
    ok: true,
    agents: descriptors,
    defaultAgentId
  });
  return true;
}

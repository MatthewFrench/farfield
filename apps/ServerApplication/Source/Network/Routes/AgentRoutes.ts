import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { logger } from "../../Shared/Logging/Logger.js";
import type { AgentRegistry } from "../../Agents/Registry.js";
import type { AgentAdapter, AgentDescriptor, AgentId } from "../../Agents/Types.js";

const AgentRouteMethodByName = {
  get: "GET"
} as const;

const AgentRoutePathnameByName = {
  listAgents: "/api/agents"
} as const;

const AgentRouteStatusCodeByName = {
  successOk: 200
} as const;

const AgentRouteLogEventByName = {
  projectDirectoryListFailed: "agent-project-directory-list-failed"
} as const;

const AgentRouteErrorMessageByName = {
  missingDefaultAgentIdentifier:
    "Agent route cannot resolve a default agent identifier from enabled, configured, or listed agents."
} as const;

const AgentRouteMaximumLoggedErrorLength = 240;
const AgentRouteTruncatedErrorSuffix = "...";
const AgentRouteProjectDirectoryListSchema = z.array(z.string());

type AgentRouteBuildDescriptor = (
  adapter: AgentAdapter,
  projectDirectories: string[]
) => AgentDescriptor;

interface AgentRouteListResponseBody {
  ok: true;
  agents: AgentDescriptor[];
  defaultAgentId: AgentId;
}

export interface AgentRouteDependencies {
  req: IncomingMessage;
  res: ServerResponse;
  pathname: string;
  registry: AgentRegistry;
  configuredAgentIds: AgentId[];
  buildAgentDescriptor: AgentRouteBuildDescriptor;
  jsonResponse: (res: ServerResponse, statusCode: number, body: object) => void;
}

/**
 * Owns list-agents route gating and response assembly.
 * This owner guarantees a concrete default agent identifier and contains
 * project-directory read failures to bounded warning logs.
 */
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

  if (!isListAgentsRouteRequest(req.method, pathname)) {
    return false;
  }

  const descriptors = await Promise.all(
    registry
      .listAdapters()
      .map((adapter) => buildAgentDescriptorWithProjectDirectories(adapter, buildAgentDescriptor))
  );

  const responseBody: AgentRouteListResponseBody = {
    ok: true,
    agents: descriptors,
    defaultAgentId: resolveDefaultAgentIdentifier(registry, configuredAgentIds, descriptors)
  };

  jsonResponse(res, AgentRouteStatusCodeByName.successOk, responseBody);
  return true;
}

function isListAgentsRouteRequest(method: string | undefined, pathname: string): boolean {
  return method === AgentRouteMethodByName.get && pathname === AgentRoutePathnameByName.listAgents;
}

async function buildAgentDescriptorWithProjectDirectories(
  adapter: AgentAdapter,
  buildAgentDescriptor: AgentRouteBuildDescriptor
): Promise<AgentDescriptor> {
  if (!adapter.listProjectDirectories || !adapter.isConnected()) {
    return buildAgentDescriptor(adapter, createEmptyProjectDirectoryList());
  }

  try {
    const projectDirectories = AgentRouteProjectDirectoryListSchema.parse(
      await adapter.listProjectDirectories()
    );
    return buildAgentDescriptor(adapter, projectDirectories);
  } catch (error) {
    logProjectDirectoryListFailure(adapter.id, String(error));
    return buildAgentDescriptor(adapter, createEmptyProjectDirectoryList());
  }
}

function createEmptyProjectDirectoryList(): string[] {
  return [];
}

function resolveDefaultAgentIdentifier(
  registry: AgentRegistry,
  configuredAgentIds: AgentId[],
  descriptors: AgentDescriptor[]
): AgentId {
  const enabledAgentIdentifier = registry.resolveDefaultAgentId();
  if (enabledAgentIdentifier !== null) {
    return enabledAgentIdentifier;
  }

  const configuredAgentIdentifier = resolveConfiguredDefaultAgentIdentifier(
    configuredAgentIds,
    descriptors
  );
  if (configuredAgentIdentifier !== null) {
    return configuredAgentIdentifier;
  }

  const firstListedAgentDescriptor = descriptors[0];
  if (firstListedAgentDescriptor !== undefined) {
    return firstListedAgentDescriptor.id;
  }

  throw new Error(AgentRouteErrorMessageByName.missingDefaultAgentIdentifier);
}

/**
 * Keeps configured defaults deterministic while ensuring listed-agent responses
 * do not point at identifiers absent from the returned descriptor collection.
 */
function resolveConfiguredDefaultAgentIdentifier(
  configuredAgentIds: AgentId[],
  descriptors: AgentDescriptor[]
): AgentId | null {
  if (descriptors.length === 0) {
    return configuredAgentIds[0] ?? null;
  }

  const listedAgentIdentifiers = new Set(descriptors.map((descriptor) => descriptor.id));
  for (const configuredAgentIdentifier of configuredAgentIds) {
    if (listedAgentIdentifiers.has(configuredAgentIdentifier)) {
      return configuredAgentIdentifier;
    }
  }

  return null;
}

function logProjectDirectoryListFailure(agentId: AgentId, errorMessage: string): void {
  logger.warn(
    {
      agentId,
      error: truncateRouteErrorMessage(errorMessage)
    },
    AgentRouteLogEventByName.projectDirectoryListFailed
  );
}

function truncateRouteErrorMessage(errorMessage: string): string {
  if (errorMessage.length <= AgentRouteMaximumLoggedErrorLength) {
    return errorMessage;
  }
  return `${errorMessage.slice(0, AgentRouteMaximumLoggedErrorLength)}${AgentRouteTruncatedErrorSuffix}`;
}

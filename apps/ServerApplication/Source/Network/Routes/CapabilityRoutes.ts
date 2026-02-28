// biome-ignore lint/nursery/noExcessiveLinesPerFile: Route-owner extraction is tracked in docs/proposed-structure-and-migration.md decision entry 20.
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
import type {
  AgentCancelAccountLoginResult,
  AgentConfigDefaults,
  AgentId,
  AgentListAppsResult,
  AgentListExperimentalFeaturesResult,
  AgentListMcpServerStatusesResult,
  AgentListSkillsResult,
  AgentReadAccountRateLimitsResult,
  AgentReadAccountResult,
  AgentReadConfigRequirementsResult,
  AgentStartAccountLoginResult,
} from "../../Agents/Types.js";
import { logger } from "../../Shared/Logging/Logger.js";

const CapabilityRouteMethodByName = {
  get: "GET",
  post: "POST",
} as const;

const CapabilityRoutePathnameByName = {
  defaults: "/api/config/defaults",
  configRequirements: "/api/config-requirements",
  configMcpServerReload: "/api/config/mcp-server/reload",
  account: "/api/account",
  accountRateLimits: "/api/account/rate-limits",
  accountLoginStart: "/api/account/login/start",
  accountLoginCancel: "/api/account/login/cancel",
  accountLogout: "/api/account/logout",
  models: "/api/models",
  collaborationModes: "/api/collaboration-modes",
  experimentalFeatures: "/api/experimental-features",
  mcpServers: "/api/mcp-servers",
  apps: "/api/apps",
  skills: "/api/skills",
} as const;

const CapabilityRouteStatusCodeByName = {
  success: 200,
  badRequest: 400,
  serviceUnavailable: 503,
} as const;

const CapabilityRouteQueryParameterByName = {
  agentId: "agentId",
  limit: "limit",
  cursor: "cursor",
  threadId: "threadId",
  forceRefetch: "forceRefetch",
  forceReload: "forceReload",
  refreshToken: "refreshToken",
  loginId: "loginId",
} as const;

const CapabilityRouteLogEventByName = {
  defaultsReadFailed: "agent-config-defaults-read-failed",
  defaultsInvalidReasoningEffort: "agent-config-defaults-invalid-reasoning-effort",
  configRequirementsReadFailed: "config-requirements-read-failed",
  accountReadFailed: "account-read-failed",
  accountRateLimitsReadFailed: "account-rate-limits-read-failed",
  accountLoginStartFailed: "account-login-start-failed",
  accountLoginCancelFailed: "account-login-cancel-failed",
  accountLogoutFailed: "account-logout-failed",
  configMcpServerReloadFailed: "config-mcp-server-reload-failed",
  modelsListTimeout: "models-list-timeout",
  collaborationModesListTimeout: "collaboration-modes-list-timeout",
  experimentalFeaturesListTimeout: "experimental-features-list-timeout",
  mcpServersListTimeout: "mcp-servers-list-timeout",
  appsListTimeout: "apps-list-timeout",
  skillsListTimeout: "skills-list-timeout",
} as const;

const CapabilityRouteErrorMessagePrefixByName = {
  invalidAgentId: "Invalid agentId: ",
  failedToReadConfigRequirements: "Failed to read config requirements: ",
  failedToReadAccount: "Failed to read account: ",
  failedToReadAccountRateLimits: "Failed to read account rate limits: ",
  failedToStartAccountLogin: "Failed to start account login: ",
  failedToCancelAccountLogin: "Failed to cancel account login: ",
  failedToLogoutAccount: "Failed to logout account: ",
  failedToReloadMcpServerConfig: "Failed to reload MCP server config: ",
  missingLoginId: "Missing loginId query parameter.",
  failedToListModels: "Failed to list models: ",
  failedToListCollaborationModes: "Failed to list collaboration modes: ",
  failedToListExperimentalFeatures: "Failed to list experimental features: ",
  failedToListMcpServers: "Failed to list MCP servers: ",
  failedToListApps: "Failed to list apps: ",
  failedToListSkills: "Failed to list skills: ",
} as const;

const CapabilityRouteTimeoutLabelByName = {
  configRequirementsRead: "config requirements read",
  accountRead: "account read",
  accountRateLimitsRead: "account rate limits read",
  accountLoginStart: "account login start",
  accountLoginCancel: "account login cancel",
  accountLogout: "account logout",
  configMcpServerReload: "config mcp server reload",
  modelsList: "models listing",
  collaborationModesList: "collaboration modes listing",
  experimentalFeaturesList: "experimental features listing",
  mcpServersList: "mcp servers listing",
  appsList: "apps listing",
  skillsList: "skills listing",
} as const;

const CapabilityRouteModelsLimitDefault = 100;
const CapabilityRouteListLimitDefault = 100;

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

interface CapabilityConfigRequirementsResponseBody {
  ok: true;
  requirements: AgentReadConfigRequirementsResult["requirements"];
}

type CapabilityAccountResponseBody = AgentReadAccountResult & {
  ok: true;
};

interface CapabilityAccountRateLimitsResponseBody {
  ok: true;
  rateLimits: AgentReadAccountRateLimitsResult["rateLimits"] | null;
  rateLimitsByLimitId: AgentReadAccountRateLimitsResult["rateLimitsByLimitId"];
}

type CapabilityAccountLoginStartResponseBody = AgentStartAccountLoginResult & {
  ok: true;
};

type CapabilityAccountLoginCancelResponseBody = AgentCancelAccountLoginResult & {
  ok: true;
};

interface CapabilityMutationResponseBody {
  ok: true;
}

type CapabilityExperimentalFeaturesResponseBody = AgentListExperimentalFeaturesResult & {
  ok: true;
};

type CapabilityMcpServersResponseBody = AgentListMcpServerStatusesResult & {
  ok: true;
};

type CapabilityAppsResponseBody = AgentListAppsResult & {
  ok: true;
};

type CapabilitySkillsResponseBody = AgentListSkillsResult & {
  ok: true;
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
  expectedMethod: string,
  expectedPathname: string,
): boolean {
  return method === expectedMethod && pathname === expectedPathname;
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

function parseBooleanQueryValue(value: string | null): boolean {
  if (value === null) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true";
}

function mapConfigRequirementsResponse(
  result: AgentReadConfigRequirementsResult,
): CapabilityConfigRequirementsResponseBody {
  return {
    ok: true,
    requirements: result.requirements,
  };
}

function mapAccountResponse(result: AgentReadAccountResult): CapabilityAccountResponseBody {
  return {
    ok: true,
    ...result,
  };
}

function mapAccountRateLimitsResponse(
  result: AgentReadAccountRateLimitsResult,
): CapabilityAccountRateLimitsResponseBody {
  return {
    ok: true,
    ...result,
  };
}

function mapStartAccountLoginResponse(
  result: AgentStartAccountLoginResult,
): CapabilityAccountLoginStartResponseBody {
  return {
    ok: true,
    ...result,
  };
}

function mapCancelAccountLoginResponse(
  result: AgentCancelAccountLoginResult,
): CapabilityAccountLoginCancelResponseBody {
  return {
    ok: true,
    ...result,
  };
}

function mapMutationSuccessResponse(): CapabilityMutationResponseBody {
  return {
    ok: true,
  };
}

function mapExperimentalFeaturesResponse(
  result: AgentListExperimentalFeaturesResult,
): CapabilityExperimentalFeaturesResponseBody {
  return {
    ok: true,
    ...result,
    nextCursor: result.nextCursor ?? null,
  };
}

function mapMcpServersResponse(
  result: AgentListMcpServerStatusesResult,
): CapabilityMcpServersResponseBody {
  return {
    ok: true,
    ...result,
    nextCursor: result.nextCursor ?? null,
  };
}

function mapAppsResponse(result: AgentListAppsResult): CapabilityAppsResponseBody {
  return {
    ok: true,
    ...result,
    nextCursor: result.nextCursor ?? null,
  };
}

function mapSkillsResponse(result: AgentListSkillsResult): CapabilitySkillsResponseBody {
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

  if (
    !isCapabilityRouteRequest(
      req.method,
      pathname,
      CapabilityRouteMethodByName.get,
      CapabilityRoutePathnameByName.defaults,
    )
  ) {
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

async function handleConfigRequirementsRoute(deps: CapabilityRouteDependencies): Promise<boolean> {
  const {
    req,
    res,
    pathname,
    url,
    capabilityListTimeoutMs,
    registry,
    parseAgentId,
    withTimeout,
    jsonResponse,
  } = deps;

  if (
    !isCapabilityRouteRequest(
      req.method,
      pathname,
      CapabilityRouteMethodByName.get,
      CapabilityRoutePathnameByName.configRequirements,
    )
  ) {
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
    jsonResponse(res, CapabilityRouteStatusCodeByName.success, {
      ok: true,
      requirements: null,
    });
    return true;
  }

  const adapter = registry.getAdapter(resolvedAgentId);
  if (
    !adapter ||
    !adapter.isEnabled() ||
    !adapter.capabilities.canReadConfigRequirements ||
    !adapter.readConfigRequirements
  ) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.success, {
      ok: true,
      requirements: null,
    });
    return true;
  }

  try {
    const result = await withTimeout(
      adapter.readConfigRequirements({}),
      capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.configRequirementsRead,
    );
    jsonResponse(
      res,
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
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToReadConfigRequirements}${message}`,
    });
  }

  return true;
}

async function handleAccountRoute(deps: CapabilityRouteDependencies): Promise<boolean> {
  const {
    req,
    res,
    pathname,
    url,
    capabilityListTimeoutMs,
    registry,
    parseAgentId,
    withTimeout,
    jsonResponse,
  } = deps;

  if (
    !isCapabilityRouteRequest(
      req.method,
      pathname,
      CapabilityRouteMethodByName.get,
      CapabilityRoutePathnameByName.account,
    )
  ) {
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
    jsonResponse(res, CapabilityRouteStatusCodeByName.success, {
      ok: true,
      account: null,
      requiresOpenaiAuth: false,
    });
    return true;
  }

  const adapter = registry.getAdapter(resolvedAgentId);
  if (
    !adapter ||
    !adapter.isEnabled() ||
    !adapter.capabilities.canReadAccount ||
    !adapter.readAccount
  ) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.success, {
      ok: true,
      account: null,
      requiresOpenaiAuth: false,
    });
    return true;
  }

  const refreshToken = parseBooleanQueryValue(
    url.searchParams.get(CapabilityRouteQueryParameterByName.refreshToken),
  );

  try {
    const result = await withTimeout(
      adapter.readAccount({
        refreshToken,
      }),
      capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.accountRead,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.success, mapAccountResponse(result));
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        agentId: resolvedAgentId,
        error: message,
      },
      CapabilityRouteLogEventByName.accountReadFailed,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToReadAccount}${message}`,
    });
  }

  return true;
}

async function handleAccountRateLimitsRoute(deps: CapabilityRouteDependencies): Promise<boolean> {
  const {
    req,
    res,
    pathname,
    url,
    capabilityListTimeoutMs,
    registry,
    parseAgentId,
    withTimeout,
    jsonResponse,
  } = deps;

  if (
    !isCapabilityRouteRequest(
      req.method,
      pathname,
      CapabilityRouteMethodByName.get,
      CapabilityRoutePathnameByName.accountRateLimits,
    )
  ) {
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
    jsonResponse(res, CapabilityRouteStatusCodeByName.success, {
      ok: true,
      rateLimits: null,
      rateLimitsByLimitId: null,
    });
    return true;
  }

  const adapter = registry.getAdapter(resolvedAgentId);
  if (
    !adapter ||
    !adapter.isEnabled() ||
    !adapter.capabilities.canReadAccountRateLimits ||
    !adapter.readAccountRateLimits
  ) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.success, {
      ok: true,
      rateLimits: null,
      rateLimitsByLimitId: null,
    });
    return true;
  }

  try {
    const result = await withTimeout(
      adapter.readAccountRateLimits({}),
      capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.accountRateLimitsRead,
    );
    jsonResponse(
      res,
      CapabilityRouteStatusCodeByName.success,
      mapAccountRateLimitsResponse(result),
    );
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        agentId: resolvedAgentId,
        error: message,
      },
      CapabilityRouteLogEventByName.accountRateLimitsReadFailed,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToReadAccountRateLimits}${message}`,
    });
  }

  return true;
}

async function handleAccountLoginStartRoute(deps: CapabilityRouteDependencies): Promise<boolean> {
  const {
    req,
    res,
    pathname,
    url,
    capabilityListTimeoutMs,
    registry,
    parseAgentId,
    withTimeout,
    jsonResponse,
  } = deps;

  if (
    !isCapabilityRouteRequest(
      req.method,
      pathname,
      CapabilityRouteMethodByName.post,
      CapabilityRoutePathnameByName.accountLoginStart,
    )
  ) {
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
  const adapter = resolvedAgentId === null ? null : registry.getAdapter(resolvedAgentId);
  if (
    !adapter ||
    !adapter.isEnabled() ||
    !adapter.capabilities.canStartAccountLogin ||
    !adapter.startAccountLogin
  ) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToStartAccountLogin}Account login is unavailable for the selected agent.`,
    });
    return true;
  }

  try {
    const result = await withTimeout(
      adapter.startAccountLogin({
        type: "chatgpt",
      }),
      capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.accountLoginStart,
    );
    jsonResponse(
      res,
      CapabilityRouteStatusCodeByName.success,
      mapStartAccountLoginResponse(result),
    );
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        agentId: resolvedAgentId,
        error: message,
      },
      CapabilityRouteLogEventByName.accountLoginStartFailed,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToStartAccountLogin}${message}`,
    });
  }

  return true;
}

async function handleAccountLoginCancelRoute(deps: CapabilityRouteDependencies): Promise<boolean> {
  const {
    req,
    res,
    pathname,
    url,
    capabilityListTimeoutMs,
    registry,
    parseAgentId,
    withTimeout,
    jsonResponse,
  } = deps;

  if (
    !isCapabilityRouteRequest(
      req.method,
      pathname,
      CapabilityRouteMethodByName.post,
      CapabilityRoutePathnameByName.accountLoginCancel,
    )
  ) {
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

  const loginIdRaw = url.searchParams.get(CapabilityRouteQueryParameterByName.loginId);
  if (loginIdRaw === null || loginIdRaw.trim().length === 0) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.missingLoginId,
    });
    return true;
  }

  const resolvedAgentId = requestedAgentId ?? registry.resolveDefaultAgentId();
  const adapter = resolvedAgentId === null ? null : registry.getAdapter(resolvedAgentId);
  if (
    !adapter ||
    !adapter.isEnabled() ||
    !adapter.capabilities.canCancelAccountLogin ||
    !adapter.cancelAccountLogin
  ) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToCancelAccountLogin}Account login cancel is unavailable for the selected agent.`,
    });
    return true;
  }

  try {
    const result = await withTimeout(
      adapter.cancelAccountLogin({
        loginId: loginIdRaw,
      }),
      capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.accountLoginCancel,
    );
    jsonResponse(
      res,
      CapabilityRouteStatusCodeByName.success,
      mapCancelAccountLoginResponse(result),
    );
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        agentId: resolvedAgentId,
        error: message,
      },
      CapabilityRouteLogEventByName.accountLoginCancelFailed,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToCancelAccountLogin}${message}`,
    });
  }

  return true;
}

async function handleAccountLogoutRoute(deps: CapabilityRouteDependencies): Promise<boolean> {
  const {
    req,
    res,
    pathname,
    url,
    capabilityListTimeoutMs,
    registry,
    parseAgentId,
    withTimeout,
    jsonResponse,
  } = deps;

  if (
    !isCapabilityRouteRequest(
      req.method,
      pathname,
      CapabilityRouteMethodByName.post,
      CapabilityRoutePathnameByName.accountLogout,
    )
  ) {
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
  const adapter = resolvedAgentId === null ? null : registry.getAdapter(resolvedAgentId);
  if (
    !adapter ||
    !adapter.isEnabled() ||
    !adapter.capabilities.canLogoutAccount ||
    !adapter.logoutAccount
  ) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToLogoutAccount}Account logout is unavailable for the selected agent.`,
    });
    return true;
  }

  try {
    await withTimeout(
      adapter.logoutAccount(),
      capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.accountLogout,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.success, mapMutationSuccessResponse());
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        agentId: resolvedAgentId,
        error: message,
      },
      CapabilityRouteLogEventByName.accountLogoutFailed,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToLogoutAccount}${message}`,
    });
  }

  return true;
}

async function handleConfigMcpServerReloadRoute(
  deps: CapabilityRouteDependencies,
): Promise<boolean> {
  const {
    req,
    res,
    pathname,
    url,
    capabilityListTimeoutMs,
    registry,
    parseAgentId,
    withTimeout,
    jsonResponse,
  } = deps;

  if (
    !isCapabilityRouteRequest(
      req.method,
      pathname,
      CapabilityRouteMethodByName.post,
      CapabilityRoutePathnameByName.configMcpServerReload,
    )
  ) {
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
  const adapter = resolvedAgentId === null ? null : registry.getAdapter(resolvedAgentId);
  if (
    !adapter ||
    !adapter.isEnabled() ||
    !adapter.capabilities.canReloadMcpServerConfig ||
    !adapter.reloadMcpServerConfig
  ) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToReloadMcpServerConfig}MCP server config reload is unavailable for the selected agent.`,
    });
    return true;
  }

  try {
    await withTimeout(
      adapter.reloadMcpServerConfig(),
      capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.configMcpServerReload,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.success, mapMutationSuccessResponse());
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        agentId: resolvedAgentId,
        error: message,
      },
      CapabilityRouteLogEventByName.configMcpServerReloadFailed,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToReloadMcpServerConfig}${message}`,
    });
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

  if (
    !isCapabilityRouteRequest(
      req.method,
      pathname,
      CapabilityRouteMethodByName.get,
      CapabilityRoutePathnameByName.models,
    )
  ) {
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
      CapabilityRouteMethodByName.get,
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

async function handleExperimentalFeaturesRoute(
  deps: CapabilityRouteDependencies,
): Promise<boolean> {
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

  if (
    !isCapabilityRouteRequest(
      req.method,
      pathname,
      CapabilityRouteMethodByName.get,
      CapabilityRoutePathnameByName.experimentalFeatures,
    )
  ) {
    return false;
  }

  const adapter = registry.resolveFirstWithCapability("canListExperimentalFeatures");
  if (!adapter || !adapter.listExperimentalFeatures) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.success, {
      ok: true,
      data: [],
      nextCursor: null,
    });
    return true;
  }

  const limit = parseInteger(
    url.searchParams.get(CapabilityRouteQueryParameterByName.limit),
    CapabilityRouteListLimitDefault,
  );
  const cursor = url.searchParams.get(CapabilityRouteQueryParameterByName.cursor);

  try {
    const result = await withTimeout(
      adapter.listExperimentalFeatures({
        limit,
        ...(cursor !== null ? { cursor } : {}),
      }),
      capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.experimentalFeaturesList,
    );
    jsonResponse(
      res,
      CapabilityRouteStatusCodeByName.success,
      mapExperimentalFeaturesResponse(result),
    );
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        error: message,
      },
      CapabilityRouteLogEventByName.experimentalFeaturesListTimeout,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToListExperimentalFeatures}${message}`,
    });
  }

  return true;
}

async function handleMcpServersRoute(deps: CapabilityRouteDependencies): Promise<boolean> {
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

  if (
    !isCapabilityRouteRequest(
      req.method,
      pathname,
      CapabilityRouteMethodByName.get,
      CapabilityRoutePathnameByName.mcpServers,
    )
  ) {
    return false;
  }

  const adapter = registry.resolveFirstWithCapability("canListMcpServerStatuses");
  if (!adapter || !adapter.listMcpServerStatuses) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.success, {
      ok: true,
      data: [],
      nextCursor: null,
    });
    return true;
  }

  const limit = parseInteger(
    url.searchParams.get(CapabilityRouteQueryParameterByName.limit),
    CapabilityRouteListLimitDefault,
  );
  const cursor = url.searchParams.get(CapabilityRouteQueryParameterByName.cursor);

  try {
    const result = await withTimeout(
      adapter.listMcpServerStatuses({
        limit,
        ...(cursor !== null ? { cursor } : {}),
      }),
      capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.mcpServersList,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.success, mapMcpServersResponse(result));
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        error: message,
      },
      CapabilityRouteLogEventByName.mcpServersListTimeout,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToListMcpServers}${message}`,
    });
  }

  return true;
}

async function handleAppsRoute(deps: CapabilityRouteDependencies): Promise<boolean> {
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

  if (
    !isCapabilityRouteRequest(
      req.method,
      pathname,
      CapabilityRouteMethodByName.get,
      CapabilityRoutePathnameByName.apps,
    )
  ) {
    return false;
  }

  const adapter = registry.resolveFirstWithCapability("canListApps");
  if (!adapter || !adapter.listApps) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.success, {
      ok: true,
      data: [],
      nextCursor: null,
    });
    return true;
  }

  const limit = parseInteger(
    url.searchParams.get(CapabilityRouteQueryParameterByName.limit),
    CapabilityRouteListLimitDefault,
  );
  const cursor = url.searchParams.get(CapabilityRouteQueryParameterByName.cursor);
  const threadId = url.searchParams.get(CapabilityRouteQueryParameterByName.threadId);
  const forceRefetch = parseBooleanQueryValue(
    url.searchParams.get(CapabilityRouteQueryParameterByName.forceRefetch),
  );

  try {
    const result = await withTimeout(
      adapter.listApps({
        limit,
        forceRefetch,
        ...(cursor !== null ? { cursor } : {}),
        ...(threadId !== null ? { threadId } : {}),
      }),
      capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.appsList,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.success, mapAppsResponse(result));
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        error: message,
      },
      CapabilityRouteLogEventByName.appsListTimeout,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToListApps}${message}`,
    });
  }

  return true;
}

async function handleSkillsRoute(deps: CapabilityRouteDependencies): Promise<boolean> {
  const { req, res, pathname, url, capabilityListTimeoutMs, registry, withTimeout, jsonResponse } =
    deps;

  if (
    !isCapabilityRouteRequest(
      req.method,
      pathname,
      CapabilityRouteMethodByName.get,
      CapabilityRoutePathnameByName.skills,
    )
  ) {
    return false;
  }

  const adapter = registry.resolveFirstWithCapability("canListSkills");
  if (!adapter || !adapter.listSkills) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.success, {
      ok: true,
      data: [],
    });
    return true;
  }

  const forceReload = parseBooleanQueryValue(
    url.searchParams.get(CapabilityRouteQueryParameterByName.forceReload),
  );

  try {
    const result = await withTimeout(
      adapter.listSkills({
        forceReload,
      }),
      capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.skillsList,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.success, mapSkillsResponse(result));
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        error: message,
      },
      CapabilityRouteLogEventByName.skillsListTimeout,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToListSkills}${message}`,
    });
  }

  return true;
}

/**
 * Owns capability route dispatch (`/api/config/defaults`, `/api/config-requirements`,
 * `/api/config/mcp-server/reload`, `/api/account`, `/api/account/rate-limits`,
 * `/api/account/login/start`, `/api/account/login/cancel`, `/api/account/logout`, `/api/models`,
 * `/api/collaboration-modes`, `/api/experimental-features`,
 * `/api/mcp-servers`, `/api/apps`, `/api/skills`)
 * route dispatch with explicit adapter-to-response mapping.
 */
export async function handleCapabilityRoutes(deps: CapabilityRouteDependencies): Promise<boolean> {
  if (await handleConfigDefaultsRoute(deps)) {
    return true;
  }
  if (await handleConfigRequirementsRoute(deps)) {
    return true;
  }
  if (await handleAccountRoute(deps)) {
    return true;
  }
  if (await handleAccountRateLimitsRoute(deps)) {
    return true;
  }
  if (await handleAccountLoginStartRoute(deps)) {
    return true;
  }
  if (await handleAccountLoginCancelRoute(deps)) {
    return true;
  }
  if (await handleAccountLogoutRoute(deps)) {
    return true;
  }
  if (await handleConfigMcpServerReloadRoute(deps)) {
    return true;
  }
  if (await handleModelsRoute(deps)) {
    return true;
  }
  if (await handleCollaborationModesRoute(deps)) {
    return true;
  }
  if (await handleExperimentalFeaturesRoute(deps)) {
    return true;
  }
  if (await handleMcpServersRoute(deps)) {
    return true;
  }
  if (await handleAppsRoute(deps)) {
    return true;
  }
  if (await handleSkillsRoute(deps)) {
    return true;
  }

  return false;
}

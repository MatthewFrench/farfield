// biome-ignore lint/nursery/noExcessiveLinesPerFile: Route-owner extraction is tracked in docs/proposed-structure-and-migration.md decision entry 20.
import { JsonValueSchema } from "@farfield/protocol";
import { z } from "zod";
import type {
  AgentCommandExecutionResult,
  AgentDetectExternalAgentConfigResult,
  AgentExportRemoteSkillResult,
  AgentFuzzyFileSearchResult,
  AgentGitDiffToRemoteResult,
  AgentId,
  AgentListAppsResult,
  AgentListExperimentalFeaturesResult,
  AgentListMcpServerStatusesResult,
  AgentListRemoteSkillsResult,
  AgentListSkillsResult,
  AgentNotificationEvents,
  AgentPendingServerRequests,
  AgentRemoteSkillsHazelnutScope,
  AgentRemoteSkillsProductSurface,
  AgentStartMcpServerOauthLoginResult,
  AgentStartWindowsSandboxSetupResult,
  AgentUploadFeedbackResult,
  AgentWindowsSandboxSetupMode,
  AgentWriteConfigValueResult,
  AgentWriteSkillsConfigResult,
} from "../../Agents/Types.js";
import { logger } from "../../Shared/Logging/Logger.js";
import { handleCapabilityAccountRoutes } from "./CapabilityAccountRouteOwner.js";
import { handleCapabilityCatalogRoutes } from "./CapabilityCatalogRouteOwner.js";
import { handleCapabilityConfigurationRoutes } from "./CapabilityConfigurationRouteOwner.js";
import {
  type CapabilityRouteDependencies,
  CapabilityRouteErrorMessagePrefixByName,
  CapabilityRouteListLimitDefault,
  CapabilityRouteLogEventByName,
  CapabilityRouteMethodByName,
  CapabilityRoutePathnameByName,
  CapabilityRouteQueryParameterByName,
  CapabilityRouteStatusCodeByName,
  CapabilityRouteTimeoutLabelByName,
  isCapabilityRouteRequest,
  parseBooleanQueryValue,
  parseBooleanQueryValueStrict,
  toErrorMessage,
} from "./CapabilityRouteContracts.js";

type CapabilityFeedbackUploadResponseBody = AgentUploadFeedbackResult & {
  ok: true;
};

type CapabilityNotificationEventsResponseBody = AgentNotificationEvents & {
  ok: true;
};

type CapabilityPendingServerRequestsResponseBody = AgentPendingServerRequests & {
  ok: true;
};

type CapabilityGitDiffToRemoteResponseBody = AgentGitDiffToRemoteResult & {
  ok: true;
};

type CapabilityFuzzyFileSearchResponseBody = AgentFuzzyFileSearchResult & {
  ok: true;
};

type CapabilityCommandExecutionResponseBody = AgentCommandExecutionResult & {
  ok: true;
};

interface CapabilityMutationResponseBody {
  ok: true;
}

interface CapabilityMcpServerOauthLoginResponseBody {
  ok: true;
  authorizationUrl: string;
}

interface CapabilitySkillsConfigWriteResponseBody {
  ok: true;
  effectiveEnabled: boolean;
}

type CapabilityConfigValueWriteResponseBody = AgentWriteConfigValueResult & {
  ok: true;
};

type CapabilityConfigBatchWriteResponseBody = AgentWriteConfigValueResult & {
  ok: true;
};

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

type CapabilitySkillsRemoteListResponseBody = AgentListRemoteSkillsResult & {
  ok: true;
};

type CapabilitySkillsRemoteExportResponseBody = AgentExportRemoteSkillResult & {
  ok: true;
};

type CapabilityExternalAgentConfigDetectResponseBody = AgentDetectExternalAgentConfigResult & {
  ok: true;
};

interface CapabilityWindowsSandboxSetupStartResponseBody {
  ok: true;
  started: boolean;
}

function parseOptionalPositiveIntegerQueryValue(value: string | null): number | null {
  if (value === null) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }
  return parsed;
}

interface NotificationEventsQueryInput {
  limit: string | undefined;
  sinceSequence: string | undefined;
}

const CAPABILITY_NOTIFICATION_EVENTS_QUERY_LIMIT_MAXIMUM = 400;
const CAPABILITY_NOTIFICATION_EVENTS_QUERY_LIMIT_DEFAULT = 80;

const CapabilityNotificationEventsQuerySchema = z
  .object({
    limit: z.preprocess(
      (value) => (value === undefined ? CAPABILITY_NOTIFICATION_EVENTS_QUERY_LIMIT_DEFAULT : value),
      z.coerce.number().int().positive().max(CAPABILITY_NOTIFICATION_EVENTS_QUERY_LIMIT_MAXIMUM),
    ),
    sinceSequence: z.preprocess(
      (value) => (value === undefined ? null : value),
      z.union([z.null(), z.coerce.number().int().nonnegative()]),
    ),
  })
  .strict();

function parseNotificationEventsQuery(searchParameters: URLSearchParams) {
  const query: NotificationEventsQueryInput = {
    limit: searchParameters.get(CapabilityRouteQueryParameterByName.limit) ?? undefined,
    sinceSequence:
      searchParameters.get(CapabilityRouteQueryParameterByName.sinceSequence) ?? undefined,
  };

  return CapabilityNotificationEventsQuerySchema.safeParse(query);
}

function parseOptionalScopesQueryValue(value: string | null): string[] | null {
  if (value === null) {
    return null;
  }
  const scopes = value
    .split(",")
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0);
  return scopes.length > 0 ? scopes : null;
}

function parseCommandArgumentsQueryValues(values: string[]): string[] | null {
  if (values.length === 0) {
    return null;
  }
  const normalizedValues = values.map((value) => value.trim());
  if (normalizedValues.some((value) => value.length === 0)) {
    return null;
  }
  return normalizedValues;
}

function parseFuzzyFileSearchRootsQueryValues(values: string[]): string[] | null {
  if (values.length === 0) {
    return null;
  }
  const normalizedValues = values.map((value) => value.trim());
  if (normalizedValues.some((value) => value.length === 0)) {
    return null;
  }
  return normalizedValues;
}

function parseOptionalWorkingDirectoryQueryValue(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function parseOptionalNonEmptyQueryValue(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function parseWorkingDirectoriesQueryValues(values: string[]): string[] | null {
  if (values.length === 0) {
    return null;
  }
  const normalizedValues = values.map((value) => value.trim());
  if (normalizedValues.some((value) => value.length === 0)) {
    return null;
  }
  return normalizedValues;
}

function parseConfigWriteMergeStrategyQueryValue(
  value: string | null,
): "replace" | "upsert" | null {
  if (value === null) {
    return null;
  }
  const normalized = value.trim();
  if (normalized === "replace") {
    return "replace";
  }
  if (normalized === "upsert") {
    return "upsert";
  }
  return null;
}

const CapabilityConfigBatchEditSchema = z
  .object({
    keyPath: z.string().min(1),
    value: JsonValueSchema,
    mergeStrategy: z.enum(["replace", "upsert"]),
  })
  .strict();
const CapabilityConfigBatchEditsSchema = z.array(CapabilityConfigBatchEditSchema).min(1);

function parseConfigBatchWriteEditsQueryValue(
  value: string | null,
): z.infer<typeof CapabilityConfigBatchEditsSchema> | null {
  if (value === null) {
    return null;
  }

  try {
    const parsedJson = JSON.parse(value);
    const parsedEdits = CapabilityConfigBatchEditsSchema.safeParse(parsedJson);
    return parsedEdits.success ? parsedEdits.data : null;
  } catch {
    return null;
  }
}

function parseConfigWriteValueQueryValue(
  value: string | null,
): z.infer<typeof JsonValueSchema> | null {
  if (value === null) {
    return null;
  }

  try {
    const parsedJson = JSON.parse(value);
    const parsedValue = JsonValueSchema.safeParse(parsedJson);
    return parsedValue.success ? parsedValue.data : null;
  } catch {
    return null;
  }
}

function parseRemoteSkillsHazelnutScopeQueryValue(
  value: string | null,
): AgentRemoteSkillsHazelnutScope | null {
  if (value === null) {
    return null;
  }
  const normalized = value.trim();
  if (normalized === "example") {
    return "example";
  }
  if (normalized === "workspace-shared") {
    return "workspace-shared";
  }
  if (normalized === "all-shared") {
    return "all-shared";
  }
  if (normalized === "personal") {
    return "personal";
  }
  return null;
}

function parseRemoteSkillsProductSurfaceQueryValue(
  value: string | null,
): AgentRemoteSkillsProductSurface | null {
  if (value === null) {
    return null;
  }
  const normalized = value.trim();
  if (normalized === "chatgpt") {
    return "chatgpt";
  }
  if (normalized === "codex") {
    return "codex";
  }
  if (normalized === "api") {
    return "api";
  }
  if (normalized === "atlas") {
    return "atlas";
  }
  return null;
}

function parseWindowsSandboxSetupModeQueryValue(
  value: string | null,
): AgentWindowsSandboxSetupMode | null {
  if (value === null) {
    return null;
  }
  const normalized = value.trim();
  if (normalized === "elevated") {
    return "elevated";
  }
  if (normalized === "unelevated") {
    return "unelevated";
  }
  return null;
}

const CapabilityExternalAgentConfigMigrationItemSchema = z
  .object({
    itemType: z.enum(["AGENTS_MD", "CONFIG", "SKILLS", "MCP_SERVER_CONFIG"]),
    description: z.string().min(1),
    cwd: z.string().min(1).nullable().optional(),
  })
  .strict();
const CapabilityExternalAgentConfigMigrationItemsSchema = z
  .array(CapabilityExternalAgentConfigMigrationItemSchema)
  .min(1);

function parseExternalAgentConfigMigrationItemsQueryValue(
  value: string | null,
): z.infer<typeof CapabilityExternalAgentConfigMigrationItemsSchema> | null {
  if (value === null) {
    return null;
  }

  try {
    const parsedJson = JSON.parse(value);
    const parsedMigrationItems =
      CapabilityExternalAgentConfigMigrationItemsSchema.safeParse(parsedJson);
    return parsedMigrationItems.success ? parsedMigrationItems.data : null;
  } catch {
    return null;
  }
}

function mapFeedbackUploadResponse(
  result: AgentUploadFeedbackResult,
): CapabilityFeedbackUploadResponseBody {
  return {
    ok: true,
    ...result,
  };
}

function mapNotificationEventsResponse(
  result: AgentNotificationEvents,
): CapabilityNotificationEventsResponseBody {
  return {
    ok: true,
    ...result,
  };
}

function mapPendingServerRequestsResponse(
  result: AgentPendingServerRequests,
): CapabilityPendingServerRequestsResponseBody {
  return {
    ok: true,
    ...result,
  };
}

function mapGitDiffToRemoteResponse(
  result: AgentGitDiffToRemoteResult,
): CapabilityGitDiffToRemoteResponseBody {
  return {
    ok: true,
    ...result,
  };
}

function mapFuzzyFileSearchResponse(
  result: AgentFuzzyFileSearchResult,
): CapabilityFuzzyFileSearchResponseBody {
  return {
    ok: true,
    ...result,
  };
}

function mapCommandExecutionResponse(
  result: AgentCommandExecutionResult,
): CapabilityCommandExecutionResponseBody {
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

function mapMcpServerOauthLoginResponse(
  result: AgentStartMcpServerOauthLoginResult,
): CapabilityMcpServerOauthLoginResponseBody {
  return {
    ok: true,
    authorizationUrl: result.authorizationUrl,
  };
}

function mapSkillsConfigWriteResponse(
  result: AgentWriteSkillsConfigResult,
): CapabilitySkillsConfigWriteResponseBody {
  return {
    ok: true,
    effectiveEnabled: result.effectiveEnabled,
  };
}

function mapConfigValueWriteResponse(
  result: AgentWriteConfigValueResult,
): CapabilityConfigValueWriteResponseBody {
  return {
    ok: true,
    ...result,
  };
}

function mapConfigBatchWriteResponse(
  result: AgentWriteConfigValueResult,
): CapabilityConfigBatchWriteResponseBody {
  return {
    ok: true,
    ...result,
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

function mapSkillsRemoteListResponse(
  result: AgentListRemoteSkillsResult,
): CapabilitySkillsRemoteListResponseBody {
  return {
    ok: true,
    ...result,
  };
}

function mapSkillsRemoteExportResponse(
  result: AgentExportRemoteSkillResult,
): CapabilitySkillsRemoteExportResponseBody {
  return {
    ok: true,
    ...result,
  };
}

function mapExternalAgentConfigDetectResponse(
  result: AgentDetectExternalAgentConfigResult,
): CapabilityExternalAgentConfigDetectResponseBody {
  return {
    ok: true,
    ...result,
  };
}

function mapWindowsSandboxSetupStartResponse(
  result: AgentStartWindowsSandboxSetupResult,
): CapabilityWindowsSandboxSetupStartResponseBody {
  return {
    ok: true,
    started: result.started,
  };
}

async function handlePendingServerRequestsRoute(
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
      CapabilityRouteMethodByName.get,
      CapabilityRoutePathnameByName.pendingServerRequests,
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
    !adapter.capabilities.canSubmitUserInput ||
    !adapter.readPendingServerRequests
  ) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToReadPendingServerRequests}Pending server-request reads are unavailable for the selected agent.`,
    });
    return true;
  }

  try {
    const result = await withTimeout(
      adapter.readPendingServerRequests(),
      capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.pendingServerRequestsRead,
    );
    jsonResponse(
      res,
      CapabilityRouteStatusCodeByName.success,
      mapPendingServerRequestsResponse(result),
    );
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        agentId: resolvedAgentId,
        error: message,
      },
      CapabilityRouteLogEventByName.pendingServerRequestsReadFailed,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToReadPendingServerRequests}${message}`,
    });
  }

  return true;
}

async function handleFeedbackUploadRoute(deps: CapabilityRouteDependencies): Promise<boolean> {
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
      CapabilityRoutePathnameByName.feedbackUpload,
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

  const classificationRaw = url.searchParams.get(
    CapabilityRouteQueryParameterByName.classification,
  );
  if (classificationRaw === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.missingFeedbackClassification,
    });
    return true;
  }
  const classification = classificationRaw.trim();
  if (classification.length === 0) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidFeedbackClassification,
    });
    return true;
  }

  const includeLogsRaw = url.searchParams.get(CapabilityRouteQueryParameterByName.includeLogs);
  if (includeLogsRaw === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.missingFeedbackIncludeLogs,
    });
    return true;
  }
  const includeLogs = parseBooleanQueryValueStrict(includeLogsRaw);
  if (includeLogs === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidFeedbackIncludeLogs,
    });
    return true;
  }

  const reasonRaw = url.searchParams.get(CapabilityRouteQueryParameterByName.reason);
  const reason = parseOptionalWorkingDirectoryQueryValue(reasonRaw);
  if (reasonRaw !== null && reason === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidFeedbackReason,
    });
    return true;
  }

  const threadIdRaw = url.searchParams.get(CapabilityRouteQueryParameterByName.threadId);
  const threadId = parseOptionalWorkingDirectoryQueryValue(threadIdRaw);
  if (threadIdRaw !== null && threadId === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidFeedbackThreadId,
    });
    return true;
  }

  const resolvedAgentId = requestedAgentId ?? registry.resolveDefaultAgentId();
  const adapter = resolvedAgentId === null ? null : registry.getAdapter(resolvedAgentId);
  if (!adapter || !adapter.isEnabled() || !adapter.uploadFeedback) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToUploadFeedback}Feedback upload is unavailable for the selected agent.`,
    });
    return true;
  }

  try {
    const result = await withTimeout(
      adapter.uploadFeedback({
        classification,
        includeLogs,
        ...(reason !== null ? { reason } : {}),
        ...(threadId !== null ? { threadId } : {}),
      }),
      capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.feedbackUpload,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.success, mapFeedbackUploadResponse(result));
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        agentId: resolvedAgentId,
        classification,
        includeLogs,
        threadId,
        error: message,
      },
      CapabilityRouteLogEventByName.feedbackUploadFailed,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToUploadFeedback}${message}`,
    });
  }

  return true;
}

async function handleNotificationEventsRoute(deps: CapabilityRouteDependencies): Promise<boolean> {
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
      CapabilityRoutePathnameByName.notificationEvents,
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

  const parsedNotificationEventsQuery = parseNotificationEventsQuery(url.searchParams);
  if (!parsedNotificationEventsQuery.success) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidNotificationEventsQueryParameters,
      details: parsedNotificationEventsQuery.error.issues,
    });
    return true;
  }

  const resolvedAgentId = requestedAgentId ?? registry.resolveDefaultAgentId();
  const adapter = resolvedAgentId === null ? null : registry.getAdapter(resolvedAgentId);
  if (
    !adapter ||
    !adapter.isEnabled() ||
    !adapter.capabilities.canReadNotificationEvents ||
    !adapter.readNotificationEvents
  ) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToReadNotificationEvents}Notification event reads are unavailable for the selected agent.`,
    });
    return true;
  }

  try {
    const result = await withTimeout(
      adapter.readNotificationEvents(parsedNotificationEventsQuery.data),
      capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.notificationEventsRead,
    );
    jsonResponse(
      res,
      CapabilityRouteStatusCodeByName.success,
      mapNotificationEventsResponse(result),
    );
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        agentId: resolvedAgentId,
        ...parsedNotificationEventsQuery.data,
        error: message,
      },
      CapabilityRouteLogEventByName.notificationEventsReadFailed,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToReadNotificationEvents}${message}`,
    });
  }

  return true;
}

async function handleGitDiffToRemoteRoute(deps: CapabilityRouteDependencies): Promise<boolean> {
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
      CapabilityRoutePathnameByName.gitDiffToRemote,
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

  const workingDirectoryRaw = url.searchParams.get(CapabilityRouteQueryParameterByName.cwd);
  if (workingDirectoryRaw === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.missingGitDiffWorkingDirectory,
    });
    return true;
  }
  const workingDirectory = parseOptionalWorkingDirectoryQueryValue(workingDirectoryRaw);
  if (workingDirectory === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidGitDiffWorkingDirectory,
    });
    return true;
  }

  const resolvedAgentId = requestedAgentId ?? registry.resolveDefaultAgentId();
  const adapter = resolvedAgentId === null ? null : registry.getAdapter(resolvedAgentId);
  if (!adapter || !adapter.isEnabled() || !adapter.gitDiffToRemote) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToReadGitDiffToRemote}Git diff to remote is unavailable for the selected agent.`,
    });
    return true;
  }

  try {
    const result = await withTimeout(
      adapter.gitDiffToRemote({
        cwd: workingDirectory,
      }),
      capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.gitDiffToRemote,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.success, mapGitDiffToRemoteResponse(result));
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        agentId: resolvedAgentId,
        cwd: workingDirectory,
        error: message,
      },
      CapabilityRouteLogEventByName.gitDiffToRemoteFailed,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToReadGitDiffToRemote}${message}`,
    });
  }

  return true;
}

async function handleCommandExecRoute(deps: CapabilityRouteDependencies): Promise<boolean> {
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
      CapabilityRoutePathnameByName.commandsExec,
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

  const commandArguments = parseCommandArgumentsQueryValues(
    url.searchParams.getAll(CapabilityRouteQueryParameterByName.command),
  );
  if (commandArguments === null) {
    const commandQueryValues = url.searchParams.getAll(CapabilityRouteQueryParameterByName.command);
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error:
        commandQueryValues.length > 0
          ? CapabilityRouteErrorMessagePrefixByName.invalidCommand
          : CapabilityRouteErrorMessagePrefixByName.missingCommand,
    });
    return true;
  }

  const timeoutMillisecondsRaw = url.searchParams.get(
    CapabilityRouteQueryParameterByName.timeoutMs,
  );
  const timeoutMilliseconds = parseOptionalPositiveIntegerQueryValue(timeoutMillisecondsRaw);
  if (timeoutMillisecondsRaw !== null && timeoutMilliseconds === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidTimeoutMilliseconds,
    });
    return true;
  }

  const workingDirectoryRaw = url.searchParams.get(CapabilityRouteQueryParameterByName.cwd);
  const workingDirectory = parseOptionalWorkingDirectoryQueryValue(workingDirectoryRaw);
  if (workingDirectoryRaw !== null && workingDirectory === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidCommandWorkingDirectory,
    });
    return true;
  }

  const resolvedAgentId = requestedAgentId ?? registry.resolveDefaultAgentId();
  const adapter = resolvedAgentId === null ? null : registry.getAdapter(resolvedAgentId);
  if (
    !adapter ||
    !adapter.isEnabled() ||
    !adapter.capabilities.canExecuteCommand ||
    !adapter.executeCommand
  ) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToExecuteCommand}Command execution is unavailable for the selected agent.`,
    });
    return true;
  }

  const routeTimeoutMilliseconds = timeoutMilliseconds ?? capabilityListTimeoutMs;
  try {
    const result = await withTimeout(
      adapter.executeCommand({
        command: commandArguments,
        ...(timeoutMilliseconds !== null ? { timeoutMilliseconds } : {}),
        ...(workingDirectory !== null ? { cwd: workingDirectory } : {}),
      }),
      routeTimeoutMilliseconds,
      CapabilityRouteTimeoutLabelByName.commandExec,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.success, mapCommandExecutionResponse(result));
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        agentId: resolvedAgentId,
        commandArguments,
        timeoutMilliseconds,
        workingDirectory,
        error: message,
      },
      CapabilityRouteLogEventByName.commandExecFailed,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToExecuteCommand}${message}`,
    });
  }

  return true;
}

async function handleFuzzyFileSearchRoute(deps: CapabilityRouteDependencies): Promise<boolean> {
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
      CapabilityRoutePathnameByName.fuzzyFileSearch,
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

  const queryRaw = url.searchParams.get(CapabilityRouteQueryParameterByName.query);
  if (queryRaw === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.missingFuzzyFileSearchQuery,
    });
    return true;
  }
  const query = parseOptionalNonEmptyQueryValue(queryRaw);
  if (query === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidFuzzyFileSearchQuery,
    });
    return true;
  }

  const rootsRaw = url.searchParams.getAll(CapabilityRouteQueryParameterByName.root);
  const roots = parseFuzzyFileSearchRootsQueryValues(rootsRaw);
  if (roots === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error:
        rootsRaw.length > 0
          ? CapabilityRouteErrorMessagePrefixByName.invalidFuzzyFileSearchRoots
          : CapabilityRouteErrorMessagePrefixByName.missingFuzzyFileSearchRoots,
    });
    return true;
  }

  const cancellationTokenRaw = url.searchParams.get(
    CapabilityRouteQueryParameterByName.cancellationToken,
  );
  const cancellationToken = parseOptionalNonEmptyQueryValue(cancellationTokenRaw);
  if (cancellationTokenRaw !== null && cancellationToken === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidFuzzyFileSearchCancellationToken,
    });
    return true;
  }

  const resolvedAgentId = requestedAgentId ?? registry.resolveDefaultAgentId();
  const adapter = resolvedAgentId === null ? null : registry.getAdapter(resolvedAgentId);
  if (
    !adapter ||
    !adapter.isEnabled() ||
    !adapter.capabilities.canSearchFuzzyFiles ||
    !adapter.fuzzyFileSearch
  ) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToSearchFuzzyFiles}Fuzzy file search is unavailable for the selected agent.`,
    });
    return true;
  }

  try {
    const result = await withTimeout(
      adapter.fuzzyFileSearch({
        query,
        roots,
        ...(cancellationToken !== null ? { cancellationToken } : {}),
      }),
      capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.fuzzyFileSearch,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.success, mapFuzzyFileSearchResponse(result));
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        agentId: resolvedAgentId,
        query,
        roots,
        cancellationToken,
        error: message,
      },
      CapabilityRouteLogEventByName.fuzzyFileSearchFailed,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToSearchFuzzyFiles}${message}`,
    });
  }

  return true;
}

async function handleFuzzyFileSearchSessionStartRoute(
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
      CapabilityRoutePathnameByName.fuzzyFileSearchSessionStart,
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

  const sessionIdRaw = url.searchParams.get(CapabilityRouteQueryParameterByName.sessionId);
  if (sessionIdRaw === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.missingFuzzyFileSearchSessionId,
    });
    return true;
  }
  const sessionId = parseOptionalNonEmptyQueryValue(sessionIdRaw);
  if (sessionId === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidFuzzyFileSearchSessionId,
    });
    return true;
  }

  const rootsRaw = url.searchParams.getAll(CapabilityRouteQueryParameterByName.root);
  const roots = parseFuzzyFileSearchRootsQueryValues(rootsRaw);
  if (roots === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error:
        rootsRaw.length > 0
          ? CapabilityRouteErrorMessagePrefixByName.invalidFuzzyFileSearchRoots
          : CapabilityRouteErrorMessagePrefixByName.missingFuzzyFileSearchRoots,
    });
    return true;
  }

  const resolvedAgentId = requestedAgentId ?? registry.resolveDefaultAgentId();
  const adapter = resolvedAgentId === null ? null : registry.getAdapter(resolvedAgentId);
  if (
    !adapter ||
    !adapter.isEnabled() ||
    !adapter.capabilities.canSearchFuzzyFiles ||
    !adapter.startFuzzyFileSearchSession
  ) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToStartFuzzyFileSearchSession}Fuzzy file search sessions are unavailable for the selected agent.`,
    });
    return true;
  }

  try {
    await withTimeout(
      adapter.startFuzzyFileSearchSession({
        sessionId,
        roots,
      }),
      capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.fuzzyFileSearchSessionStart,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.success, { ok: true });
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        agentId: resolvedAgentId,
        sessionId,
        roots,
        error: message,
      },
      CapabilityRouteLogEventByName.fuzzyFileSearchSessionStartFailed,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToStartFuzzyFileSearchSession}${message}`,
    });
  }

  return true;
}

async function handleFuzzyFileSearchSessionUpdateRoute(
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
      CapabilityRoutePathnameByName.fuzzyFileSearchSessionUpdate,
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

  const sessionIdRaw = url.searchParams.get(CapabilityRouteQueryParameterByName.sessionId);
  if (sessionIdRaw === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.missingFuzzyFileSearchSessionId,
    });
    return true;
  }
  const sessionId = parseOptionalNonEmptyQueryValue(sessionIdRaw);
  if (sessionId === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidFuzzyFileSearchSessionId,
    });
    return true;
  }

  const queryRaw = url.searchParams.get(CapabilityRouteQueryParameterByName.query);
  if (queryRaw === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.missingFuzzyFileSearchQuery,
    });
    return true;
  }
  const query = parseOptionalNonEmptyQueryValue(queryRaw);
  if (query === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidFuzzyFileSearchQuery,
    });
    return true;
  }

  const resolvedAgentId = requestedAgentId ?? registry.resolveDefaultAgentId();
  const adapter = resolvedAgentId === null ? null : registry.getAdapter(resolvedAgentId);
  if (
    !adapter ||
    !adapter.isEnabled() ||
    !adapter.capabilities.canSearchFuzzyFiles ||
    !adapter.updateFuzzyFileSearchSession
  ) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToUpdateFuzzyFileSearchSession}Fuzzy file search sessions are unavailable for the selected agent.`,
    });
    return true;
  }

  try {
    await withTimeout(
      adapter.updateFuzzyFileSearchSession({
        sessionId,
        query,
      }),
      capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.fuzzyFileSearchSessionUpdate,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.success, { ok: true });
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        agentId: resolvedAgentId,
        sessionId,
        query,
        error: message,
      },
      CapabilityRouteLogEventByName.fuzzyFileSearchSessionUpdateFailed,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToUpdateFuzzyFileSearchSession}${message}`,
    });
  }

  return true;
}

async function handleFuzzyFileSearchSessionStopRoute(
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
      CapabilityRoutePathnameByName.fuzzyFileSearchSessionStop,
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

  const sessionIdRaw = url.searchParams.get(CapabilityRouteQueryParameterByName.sessionId);
  if (sessionIdRaw === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.missingFuzzyFileSearchSessionId,
    });
    return true;
  }
  const sessionId = parseOptionalNonEmptyQueryValue(sessionIdRaw);
  if (sessionId === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidFuzzyFileSearchSessionId,
    });
    return true;
  }

  const resolvedAgentId = requestedAgentId ?? registry.resolveDefaultAgentId();
  const adapter = resolvedAgentId === null ? null : registry.getAdapter(resolvedAgentId);
  if (
    !adapter ||
    !adapter.isEnabled() ||
    !adapter.capabilities.canSearchFuzzyFiles ||
    !adapter.stopFuzzyFileSearchSession
  ) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToStopFuzzyFileSearchSession}Fuzzy file search sessions are unavailable for the selected agent.`,
    });
    return true;
  }

  try {
    await withTimeout(
      adapter.stopFuzzyFileSearchSession({
        sessionId,
      }),
      capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.fuzzyFileSearchSessionStop,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.success, { ok: true });
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        agentId: resolvedAgentId,
        sessionId,
        error: message,
      },
      CapabilityRouteLogEventByName.fuzzyFileSearchSessionStopFailed,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToStopFuzzyFileSearchSession}${message}`,
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

async function handleConfigBatchWriteRoute(deps: CapabilityRouteDependencies): Promise<boolean> {
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
      CapabilityRoutePathnameByName.configBatchWrite,
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

  const editsRaw = url.searchParams.get(CapabilityRouteQueryParameterByName.edits);
  if (editsRaw === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.missingConfigBatchEdits,
    });
    return true;
  }
  const edits = parseConfigBatchWriteEditsQueryValue(editsRaw);
  if (edits === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidConfigBatchEdits,
    });
    return true;
  }

  const filePathRaw = url.searchParams.get(CapabilityRouteQueryParameterByName.filePath);
  const filePath = parseOptionalWorkingDirectoryQueryValue(filePathRaw);
  if (filePathRaw !== null && filePath === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidConfigFilePath,
    });
    return true;
  }

  const expectedVersionRaw = url.searchParams.get(
    CapabilityRouteQueryParameterByName.expectedVersion,
  );
  const expectedVersion = parseOptionalWorkingDirectoryQueryValue(expectedVersionRaw);
  if (expectedVersionRaw !== null && expectedVersion === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidConfigExpectedVersion,
    });
    return true;
  }

  const resolvedAgentId = requestedAgentId ?? registry.resolveDefaultAgentId();
  const adapter = resolvedAgentId === null ? null : registry.getAdapter(resolvedAgentId);
  if (
    !adapter ||
    !adapter.isEnabled() ||
    !adapter.capabilities.canWriteConfigValue ||
    !adapter.writeConfigBatch
  ) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToWriteConfigBatch}Config batch write is unavailable for the selected agent.`,
    });
    return true;
  }

  try {
    const result = await withTimeout(
      adapter.writeConfigBatch({
        edits: edits.map((edit) => ({
          keyPath: edit.keyPath,
          value: edit.value,
          mergeStrategy: edit.mergeStrategy,
        })),
        ...(filePath !== null ? { filePath } : {}),
        ...(expectedVersion !== null ? { expectedVersion } : {}),
      }),
      capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.configBatchWrite,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.success, mapConfigBatchWriteResponse(result));
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        agentId: resolvedAgentId,
        editCount: edits.length,
        filePath,
        expectedVersion,
        error: message,
      },
      CapabilityRouteLogEventByName.configBatchWriteFailed,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToWriteConfigBatch}${message}`,
    });
  }

  return true;
}

async function handleConfigValueWriteRoute(deps: CapabilityRouteDependencies): Promise<boolean> {
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
      CapabilityRoutePathnameByName.configValueWrite,
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

  const keyPath = url.searchParams.get(CapabilityRouteQueryParameterByName.keyPath);
  if (keyPath === null || keyPath.trim().length === 0) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.missingConfigKeyPath,
    });
    return true;
  }
  const normalizedKeyPath = keyPath.trim();

  const valueRaw = url.searchParams.get(CapabilityRouteQueryParameterByName.value);
  if (valueRaw === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.missingConfigValue,
    });
    return true;
  }
  const value = parseConfigWriteValueQueryValue(valueRaw);
  if (value === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidConfigValue,
    });
    return true;
  }

  const mergeStrategyRaw = url.searchParams.get(CapabilityRouteQueryParameterByName.mergeStrategy);
  if (mergeStrategyRaw === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.missingConfigMergeStrategy,
    });
    return true;
  }
  const mergeStrategy = parseConfigWriteMergeStrategyQueryValue(mergeStrategyRaw);
  if (mergeStrategy === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidConfigMergeStrategy,
    });
    return true;
  }

  const filePathRaw = url.searchParams.get(CapabilityRouteQueryParameterByName.filePath);
  const filePath = parseOptionalWorkingDirectoryQueryValue(filePathRaw);
  if (filePathRaw !== null && filePath === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidConfigFilePath,
    });
    return true;
  }

  const expectedVersionRaw = url.searchParams.get(
    CapabilityRouteQueryParameterByName.expectedVersion,
  );
  const expectedVersion = parseOptionalWorkingDirectoryQueryValue(expectedVersionRaw);
  if (expectedVersionRaw !== null && expectedVersion === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidConfigExpectedVersion,
    });
    return true;
  }

  const resolvedAgentId = requestedAgentId ?? registry.resolveDefaultAgentId();
  const adapter = resolvedAgentId === null ? null : registry.getAdapter(resolvedAgentId);
  if (
    !adapter ||
    !adapter.isEnabled() ||
    !adapter.capabilities.canWriteConfigValue ||
    !adapter.writeConfigValue
  ) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToWriteConfigValue}Config value write is unavailable for the selected agent.`,
    });
    return true;
  }

  try {
    const result = await withTimeout(
      adapter.writeConfigValue({
        keyPath: normalizedKeyPath,
        value,
        mergeStrategy,
        ...(filePath !== null ? { filePath } : {}),
        ...(expectedVersion !== null ? { expectedVersion } : {}),
      }),
      capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.configValueWrite,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.success, mapConfigValueWriteResponse(result));
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        agentId: resolvedAgentId,
        keyPath: normalizedKeyPath,
        mergeStrategy,
        filePath,
        expectedVersion,
        error: message,
      },
      CapabilityRouteLogEventByName.configValueWriteFailed,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToWriteConfigValue}${message}`,
    });
  }

  return true;
}

async function handleMcpServerOauthLoginRoute(deps: CapabilityRouteDependencies): Promise<boolean> {
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
      CapabilityRoutePathnameByName.mcpServerOauthLogin,
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

  const name = url.searchParams.get(CapabilityRouteQueryParameterByName.name);
  if (name === null || name.trim().length === 0) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.missingMcpServerName,
    });
    return true;
  }
  const normalizedName = name.trim();

  const timeoutSecondsRaw = url.searchParams.get(
    CapabilityRouteQueryParameterByName.timeoutSeconds,
  );
  const timeoutSeconds = parseOptionalPositiveIntegerQueryValue(timeoutSecondsRaw);
  if (timeoutSecondsRaw !== null && timeoutSeconds === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidTimeoutSeconds,
    });
    return true;
  }

  const scopes = parseOptionalScopesQueryValue(
    url.searchParams.get(CapabilityRouteQueryParameterByName.scopes),
  );

  const resolvedAgentId = requestedAgentId ?? registry.resolveDefaultAgentId();
  const adapter = resolvedAgentId === null ? null : registry.getAdapter(resolvedAgentId);
  if (
    !adapter ||
    !adapter.isEnabled() ||
    !adapter.capabilities.canStartMcpServerOauthLogin ||
    !adapter.startMcpServerOauthLogin
  ) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToStartMcpServerOauthLogin}MCP server oauth login is unavailable for the selected agent.`,
    });
    return true;
  }

  try {
    const result = await withTimeout(
      adapter.startMcpServerOauthLogin({
        name: normalizedName,
        ...(scopes !== null ? { scopes } : {}),
        ...(timeoutSeconds !== null ? { timeoutSeconds } : {}),
      }),
      capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.mcpServerOauthLogin,
    );
    jsonResponse(
      res,
      CapabilityRouteStatusCodeByName.success,
      mapMcpServerOauthLoginResponse(result),
    );
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        agentId: resolvedAgentId,
        name: normalizedName,
        error: message,
      },
      CapabilityRouteLogEventByName.mcpServerOauthLoginFailed,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToStartMcpServerOauthLogin}${message}`,
    });
  }

  return true;
}

async function handleSkillsConfigWriteRoute(deps: CapabilityRouteDependencies): Promise<boolean> {
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
      CapabilityRoutePathnameByName.skillsConfigWrite,
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

  const path = url.searchParams.get(CapabilityRouteQueryParameterByName.path);
  if (path === null || path.trim().length === 0) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.missingSkillPath,
    });
    return true;
  }
  const normalizedPath = path.trim();

  const enabledRaw = url.searchParams.get(CapabilityRouteQueryParameterByName.enabled);
  if (enabledRaw === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.missingSkillEnabled,
    });
    return true;
  }
  const enabled = parseBooleanQueryValueStrict(enabledRaw);
  if (enabled === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidSkillEnabled,
    });
    return true;
  }

  const resolvedAgentId = requestedAgentId ?? registry.resolveDefaultAgentId();
  const adapter = resolvedAgentId === null ? null : registry.getAdapter(resolvedAgentId);
  if (
    !adapter ||
    !adapter.isEnabled() ||
    !adapter.capabilities.canWriteSkillsConfig ||
    !adapter.writeSkillsConfig
  ) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToWriteSkillsConfig}Skills config write is unavailable for the selected agent.`,
    });
    return true;
  }

  try {
    const result = await withTimeout(
      adapter.writeSkillsConfig({
        path: normalizedPath,
        enabled,
      }),
      capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.skillsConfigWrite,
    );
    jsonResponse(
      res,
      CapabilityRouteStatusCodeByName.success,
      mapSkillsConfigWriteResponse(result),
    );
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        agentId: resolvedAgentId,
        path: normalizedPath,
        enabled,
        error: message,
      },
      CapabilityRouteLogEventByName.skillsConfigWriteFailed,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToWriteSkillsConfig}${message}`,
    });
  }

  return true;
}

async function handleSkillsRemoteListRoute(deps: CapabilityRouteDependencies): Promise<boolean> {
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
      CapabilityRoutePathnameByName.skillsRemoteList,
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

  const hazelnutScopeRaw = url.searchParams.get(CapabilityRouteQueryParameterByName.hazelnutScope);
  if (hazelnutScopeRaw === null || hazelnutScopeRaw.trim().length === 0) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.missingRemoteSkillsHazelnutScope,
    });
    return true;
  }
  const hazelnutScope = parseRemoteSkillsHazelnutScopeQueryValue(hazelnutScopeRaw);
  if (hazelnutScope === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidRemoteSkillsHazelnutScope,
    });
    return true;
  }

  const productSurfaceRaw = url.searchParams.get(
    CapabilityRouteQueryParameterByName.productSurface,
  );
  if (productSurfaceRaw === null || productSurfaceRaw.trim().length === 0) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.missingRemoteSkillsProductSurface,
    });
    return true;
  }
  const productSurface = parseRemoteSkillsProductSurfaceQueryValue(productSurfaceRaw);
  if (productSurface === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidRemoteSkillsProductSurface,
    });
    return true;
  }

  const enabledRaw = url.searchParams.get(CapabilityRouteQueryParameterByName.enabled);
  if (enabledRaw === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.missingRemoteSkillsEnabled,
    });
    return true;
  }
  const enabled = parseBooleanQueryValueStrict(enabledRaw);
  if (enabled === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidRemoteSkillsEnabled,
    });
    return true;
  }

  const resolvedAgentId = requestedAgentId ?? registry.resolveDefaultAgentId();
  const adapter = resolvedAgentId === null ? null : registry.getAdapter(resolvedAgentId);
  if (
    !adapter ||
    !adapter.isEnabled() ||
    !adapter.capabilities.canListSkills ||
    !adapter.listRemoteSkills
  ) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToListRemoteSkills}Remote skills list is unavailable for the selected agent.`,
    });
    return true;
  }

  try {
    const result = await withTimeout(
      adapter.listRemoteSkills({
        hazelnutScope,
        productSurface,
        enabled,
      }),
      capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.skillsRemoteList,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.success, mapSkillsRemoteListResponse(result));
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        agentId: resolvedAgentId,
        hazelnutScope,
        productSurface,
        enabled,
        error: message,
      },
      CapabilityRouteLogEventByName.skillsRemoteListFailed,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToListRemoteSkills}${message}`,
    });
  }

  return true;
}

async function handleSkillsRemoteExportRoute(deps: CapabilityRouteDependencies): Promise<boolean> {
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
      CapabilityRoutePathnameByName.skillsRemoteExport,
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

  const hazelnutIdRaw = url.searchParams.get(CapabilityRouteQueryParameterByName.hazelnutId);
  if (hazelnutIdRaw === null || hazelnutIdRaw.trim().length === 0) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.missingRemoteSkillHazelnutId,
    });
    return true;
  }
  const hazelnutId = hazelnutIdRaw.trim();

  const resolvedAgentId = requestedAgentId ?? registry.resolveDefaultAgentId();
  const adapter = resolvedAgentId === null ? null : registry.getAdapter(resolvedAgentId);
  if (
    !adapter ||
    !adapter.isEnabled() ||
    !adapter.capabilities.canWriteSkillsConfig ||
    !adapter.exportRemoteSkill
  ) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToExportRemoteSkill}Remote skill export is unavailable for the selected agent.`,
    });
    return true;
  }

  try {
    const result = await withTimeout(
      adapter.exportRemoteSkill({
        hazelnutId,
      }),
      capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.skillsRemoteExport,
    );
    jsonResponse(
      res,
      CapabilityRouteStatusCodeByName.success,
      mapSkillsRemoteExportResponse(result),
    );
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        agentId: resolvedAgentId,
        hazelnutId,
        error: message,
      },
      CapabilityRouteLogEventByName.skillsRemoteExportFailed,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToExportRemoteSkill}${message}`,
    });
  }

  return true;
}

async function handleExternalAgentConfigDetectRoute(
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
      CapabilityRouteMethodByName.get,
      CapabilityRoutePathnameByName.externalAgentConfigDetect,
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

  const includeHomeRaw = url.searchParams.get(CapabilityRouteQueryParameterByName.includeHome);
  const includeHome = parseBooleanQueryValueStrict(includeHomeRaw);
  if (includeHomeRaw !== null && includeHome === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidExternalAgentConfigIncludeHome,
    });
    return true;
  }

  const cwdsRaw = url.searchParams.getAll(CapabilityRouteQueryParameterByName.cwd);
  const cwds = parseWorkingDirectoriesQueryValues(cwdsRaw);
  if (cwdsRaw.length > 0 && cwds === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidExternalAgentConfigDetectCwds,
    });
    return true;
  }

  const resolvedIncludeHome = includeHome ?? false;
  if (!resolvedIncludeHome && cwds === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.missingExternalAgentConfigDetectTargets,
    });
    return true;
  }

  const resolvedAgentId = requestedAgentId ?? registry.resolveDefaultAgentId();
  const adapter = resolvedAgentId === null ? null : registry.getAdapter(resolvedAgentId);
  if (
    !adapter ||
    !adapter.isEnabled() ||
    !adapter.capabilities.canDetectExternalAgentConfig ||
    !adapter.detectExternalAgentConfig
  ) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToDetectExternalAgentConfig}External-agent config detection is unavailable for the selected agent.`,
    });
    return true;
  }

  try {
    const result = await withTimeout(
      adapter.detectExternalAgentConfig({
        includeHome: resolvedIncludeHome,
        ...(cwds !== null ? { cwds } : {}),
      }),
      capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.externalAgentConfigDetect,
    );
    jsonResponse(
      res,
      CapabilityRouteStatusCodeByName.success,
      mapExternalAgentConfigDetectResponse(result),
    );
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        agentId: resolvedAgentId,
        includeHome: resolvedIncludeHome,
        cwdCount: cwds?.length ?? 0,
        error: message,
      },
      CapabilityRouteLogEventByName.externalAgentConfigDetectFailed,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToDetectExternalAgentConfig}${message}`,
    });
  }

  return true;
}

async function handleExternalAgentConfigImportRoute(
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
      CapabilityRoutePathnameByName.externalAgentConfigImport,
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

  const migrationItemsRaw = url.searchParams.get(
    CapabilityRouteQueryParameterByName.migrationItems,
  );
  if (migrationItemsRaw === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.missingExternalAgentConfigMigrationItems,
    });
    return true;
  }
  const migrationItems = parseExternalAgentConfigMigrationItemsQueryValue(migrationItemsRaw);
  if (migrationItems === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidExternalAgentConfigMigrationItems,
    });
    return true;
  }

  const resolvedAgentId = requestedAgentId ?? registry.resolveDefaultAgentId();
  const adapter = resolvedAgentId === null ? null : registry.getAdapter(resolvedAgentId);
  if (
    !adapter ||
    !adapter.isEnabled() ||
    !adapter.capabilities.canImportExternalAgentConfig ||
    !adapter.importExternalAgentConfig
  ) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToImportExternalAgentConfig}External-agent config import is unavailable for the selected agent.`,
    });
    return true;
  }

  try {
    await withTimeout(
      adapter.importExternalAgentConfig({
        migrationItems: migrationItems.map((migrationItem) => ({
          itemType: migrationItem.itemType,
          description: migrationItem.description,
          cwd: migrationItem.cwd ?? null,
        })),
      }),
      capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.externalAgentConfigImport,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.success, mapMutationSuccessResponse());
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        agentId: resolvedAgentId,
        migrationItemCount: migrationItems.length,
        error: message,
      },
      CapabilityRouteLogEventByName.externalAgentConfigImportFailed,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToImportExternalAgentConfig}${message}`,
    });
  }

  return true;
}

async function handleThreadRealtimeStartRoute(deps: CapabilityRouteDependencies): Promise<boolean> {
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
      CapabilityRoutePathnameByName.threadRealtimeStart,
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

  const threadIdRaw = url.searchParams.get(CapabilityRouteQueryParameterByName.threadId);
  if (threadIdRaw === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.missingThreadRealtimeThreadId,
    });
    return true;
  }
  const threadId = parseOptionalNonEmptyQueryValue(threadIdRaw);
  if (threadId === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidThreadRealtimeThreadId,
    });
    return true;
  }

  const promptRaw = url.searchParams.get(CapabilityRouteQueryParameterByName.prompt);
  if (promptRaw === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.missingThreadRealtimePrompt,
    });
    return true;
  }
  const prompt = parseOptionalNonEmptyQueryValue(promptRaw);
  if (prompt === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidThreadRealtimePrompt,
    });
    return true;
  }

  const sessionIdRaw = url.searchParams.get(CapabilityRouteQueryParameterByName.sessionId);
  const sessionId = parseOptionalNonEmptyQueryValue(sessionIdRaw);
  if (sessionIdRaw !== null && sessionId === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidThreadRealtimeSessionId,
    });
    return true;
  }

  const resolvedAgentId = requestedAgentId ?? registry.resolveDefaultAgentId();
  const adapter = resolvedAgentId === null ? null : registry.getAdapter(resolvedAgentId);
  if (
    !adapter ||
    !adapter.isEnabled() ||
    !adapter.capabilities.canStartThreadRealtime ||
    !adapter.startThreadRealtime
  ) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToStartThreadRealtime}Thread realtime start is unavailable for the selected agent.`,
    });
    return true;
  }

  try {
    await withTimeout(
      adapter.startThreadRealtime({
        threadId,
        prompt,
        ...(sessionId !== null ? { sessionId } : {}),
      }),
      capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.threadRealtimeStart,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.success, mapMutationSuccessResponse());
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        agentId: resolvedAgentId,
        threadId,
        hasSessionId: sessionId !== null,
        error: message,
      },
      CapabilityRouteLogEventByName.threadRealtimeStartFailed,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToStartThreadRealtime}${message}`,
    });
  }

  return true;
}

async function handleThreadRealtimeAppendAudioRoute(
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
      CapabilityRoutePathnameByName.threadRealtimeAppendAudio,
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

  const threadIdRaw = url.searchParams.get(CapabilityRouteQueryParameterByName.threadId);
  if (threadIdRaw === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.missingThreadRealtimeThreadId,
    });
    return true;
  }
  const threadId = parseOptionalNonEmptyQueryValue(threadIdRaw);
  if (threadId === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidThreadRealtimeThreadId,
    });
    return true;
  }

  const audioDataRaw = url.searchParams.get(CapabilityRouteQueryParameterByName.audioData);
  if (audioDataRaw === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.missingThreadRealtimeAudioData,
    });
    return true;
  }
  const audioData = parseOptionalNonEmptyQueryValue(audioDataRaw);
  if (audioData === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidThreadRealtimeAudioData,
    });
    return true;
  }

  const audioSampleRateRaw = url.searchParams.get(
    CapabilityRouteQueryParameterByName.audioSampleRate,
  );
  if (audioSampleRateRaw === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.missingThreadRealtimeAudioSampleRate,
    });
    return true;
  }
  const audioSampleRate = parseOptionalPositiveIntegerQueryValue(audioSampleRateRaw);
  if (audioSampleRate === null || audioSampleRate <= 0) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidThreadRealtimeAudioSampleRate,
    });
    return true;
  }

  const audioNumChannelsRaw = url.searchParams.get(
    CapabilityRouteQueryParameterByName.audioNumChannels,
  );
  if (audioNumChannelsRaw === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.missingThreadRealtimeAudioNumChannels,
    });
    return true;
  }
  const audioNumChannels = parseOptionalPositiveIntegerQueryValue(audioNumChannelsRaw);
  if (audioNumChannels === null || audioNumChannels <= 0) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidThreadRealtimeAudioNumChannels,
    });
    return true;
  }

  const audioSamplesPerChannelRaw = url.searchParams.get(
    CapabilityRouteQueryParameterByName.audioSamplesPerChannel,
  );
  const audioSamplesPerChannel = parseOptionalPositiveIntegerQueryValue(audioSamplesPerChannelRaw);
  if (
    audioSamplesPerChannelRaw !== null &&
    (audioSamplesPerChannel === null || audioSamplesPerChannel <= 0)
  ) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidThreadRealtimeAudioSamplesPerChannel,
    });
    return true;
  }

  const resolvedAgentId = requestedAgentId ?? registry.resolveDefaultAgentId();
  const adapter = resolvedAgentId === null ? null : registry.getAdapter(resolvedAgentId);
  if (
    !adapter ||
    !adapter.isEnabled() ||
    !adapter.capabilities.canAppendThreadRealtimeAudio ||
    !adapter.appendThreadRealtimeAudio
  ) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToAppendThreadRealtimeAudio}Thread realtime audio append is unavailable for the selected agent.`,
    });
    return true;
  }

  try {
    await withTimeout(
      adapter.appendThreadRealtimeAudio({
        threadId,
        audio: {
          data: audioData,
          sampleRate: audioSampleRate,
          numChannels: audioNumChannels,
          ...(audioSamplesPerChannel !== null ? { samplesPerChannel: audioSamplesPerChannel } : {}),
        },
      }),
      capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.threadRealtimeAppendAudio,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.success, mapMutationSuccessResponse());
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        agentId: resolvedAgentId,
        threadId,
        audioDataLength: audioData.length,
        audioSampleRate,
        audioNumChannels,
        audioSamplesPerChannel,
        error: message,
      },
      CapabilityRouteLogEventByName.threadRealtimeAppendAudioFailed,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToAppendThreadRealtimeAudio}${message}`,
    });
  }

  return true;
}

async function handleThreadRealtimeAppendTextRoute(
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
      CapabilityRoutePathnameByName.threadRealtimeAppendText,
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

  const threadIdRaw = url.searchParams.get(CapabilityRouteQueryParameterByName.threadId);
  if (threadIdRaw === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.missingThreadRealtimeThreadId,
    });
    return true;
  }
  const threadId = parseOptionalNonEmptyQueryValue(threadIdRaw);
  if (threadId === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidThreadRealtimeThreadId,
    });
    return true;
  }

  const textRaw = url.searchParams.get(CapabilityRouteQueryParameterByName.text);
  if (textRaw === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.missingThreadRealtimeText,
    });
    return true;
  }
  const text = parseOptionalNonEmptyQueryValue(textRaw);
  if (text === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidThreadRealtimeText,
    });
    return true;
  }

  const resolvedAgentId = requestedAgentId ?? registry.resolveDefaultAgentId();
  const adapter = resolvedAgentId === null ? null : registry.getAdapter(resolvedAgentId);
  if (
    !adapter ||
    !adapter.isEnabled() ||
    !adapter.capabilities.canAppendThreadRealtimeText ||
    !adapter.appendThreadRealtimeText
  ) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToAppendThreadRealtimeText}Thread realtime text append is unavailable for the selected agent.`,
    });
    return true;
  }

  try {
    await withTimeout(
      adapter.appendThreadRealtimeText({
        threadId,
        text,
      }),
      capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.threadRealtimeAppendText,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.success, mapMutationSuccessResponse());
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        agentId: resolvedAgentId,
        threadId,
        textLength: text.length,
        error: message,
      },
      CapabilityRouteLogEventByName.threadRealtimeAppendTextFailed,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToAppendThreadRealtimeText}${message}`,
    });
  }

  return true;
}

async function handleThreadRealtimeStopRoute(deps: CapabilityRouteDependencies): Promise<boolean> {
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
      CapabilityRoutePathnameByName.threadRealtimeStop,
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

  const threadIdRaw = url.searchParams.get(CapabilityRouteQueryParameterByName.threadId);
  if (threadIdRaw === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.missingThreadRealtimeThreadId,
    });
    return true;
  }
  const threadId = parseOptionalNonEmptyQueryValue(threadIdRaw);
  if (threadId === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidThreadRealtimeThreadId,
    });
    return true;
  }

  const resolvedAgentId = requestedAgentId ?? registry.resolveDefaultAgentId();
  const adapter = resolvedAgentId === null ? null : registry.getAdapter(resolvedAgentId);
  if (
    !adapter ||
    !adapter.isEnabled() ||
    !adapter.capabilities.canStopThreadRealtime ||
    !adapter.stopThreadRealtime
  ) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToStopThreadRealtime}Thread realtime stop is unavailable for the selected agent.`,
    });
    return true;
  }

  try {
    await withTimeout(
      adapter.stopThreadRealtime({
        threadId,
      }),
      capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.threadRealtimeStop,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.success, mapMutationSuccessResponse());
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        agentId: resolvedAgentId,
        threadId,
        error: message,
      },
      CapabilityRouteLogEventByName.threadRealtimeStopFailed,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToStopThreadRealtime}${message}`,
    });
  }

  return true;
}

async function handleWindowsSandboxSetupStartRoute(
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
      CapabilityRoutePathnameByName.windowsSandboxSetupStart,
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

  const modeRaw = url.searchParams.get(CapabilityRouteQueryParameterByName.mode);
  if (modeRaw === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.missingWindowsSandboxMode,
    });
    return true;
  }
  const mode = parseWindowsSandboxSetupModeQueryValue(modeRaw);
  if (mode === null) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidWindowsSandboxMode,
    });
    return true;
  }

  const resolvedAgentId = requestedAgentId ?? registry.resolveDefaultAgentId();
  const adapter = resolvedAgentId === null ? null : registry.getAdapter(resolvedAgentId);
  if (
    !adapter ||
    !adapter.isEnabled() ||
    !adapter.capabilities.canStartWindowsSandboxSetup ||
    !adapter.startWindowsSandboxSetup
  ) {
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToStartWindowsSandboxSetup}Windows sandbox setup is unavailable for the selected agent.`,
    });
    return true;
  }

  try {
    const result = await withTimeout(
      adapter.startWindowsSandboxSetup({
        mode,
      }),
      capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.windowsSandboxSetupStart,
    );
    jsonResponse(
      res,
      CapabilityRouteStatusCodeByName.success,
      mapWindowsSandboxSetupStartResponse(result),
    );
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        agentId: resolvedAgentId,
        mode,
        error: message,
      },
      CapabilityRouteLogEventByName.windowsSandboxSetupStartFailed,
    );
    jsonResponse(res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToStartWindowsSandboxSetup}${message}`,
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
 * `/api/config/mcp-server/reload`, `/api/account`, `/api/account/auth-status`,
 * `/api/account/rate-limits`, `/api/account/user-info`, `/api/server-requests/pending`,
 * `/api/feedback/upload`,
 * `/api/notifications/events`,
 * `/api/git/diff-remote`, `/api/files/fuzzy-search`,
 * `/api/files/fuzzy-search/session-start`, `/api/files/fuzzy-search/session-update`,
 * `/api/files/fuzzy-search/session-stop`, `/api/commands/exec`, `/api/account/login/start`,
 * `/api/account/login/cancel`, `/api/account/logout`,
 * `/api/config/batch/write`, `/api/config/value/write`, `/api/mcp-servers/oauth/login`, `/api/skills/config/write`,
 * `/api/skills/remote/list`, `/api/skills/remote/export`,
 * `/api/external-agent-config/detect`, `/api/external-agent-config/import`,
 * `/api/threads/realtime/start`, `/api/threads/realtime/append-audio`,
 * `/api/threads/realtime/append-text`, `/api/threads/realtime/stop`,
 * `/api/windows-sandbox/setup-start`, `/api/models`,
 * `/api/collaboration-modes`, `/api/experimental-features`,
 * `/api/mcp-servers`, `/api/apps`, `/api/skills`)
 * route dispatch with explicit adapter-to-response mapping.
 */
export async function handleCapabilityRoutes(deps: CapabilityRouteDependencies): Promise<boolean> {
  if (await handleCapabilityConfigurationRoutes(deps)) {
    return true;
  }
  if (await handleCapabilityAccountRoutes(deps)) {
    return true;
  }
  if (await handlePendingServerRequestsRoute(deps)) {
    return true;
  }
  if (await handleFeedbackUploadRoute(deps)) {
    return true;
  }
  if (await handleNotificationEventsRoute(deps)) {
    return true;
  }
  if (await handleGitDiffToRemoteRoute(deps)) {
    return true;
  }
  if (await handleFuzzyFileSearchRoute(deps)) {
    return true;
  }
  if (await handleFuzzyFileSearchSessionStartRoute(deps)) {
    return true;
  }
  if (await handleFuzzyFileSearchSessionUpdateRoute(deps)) {
    return true;
  }
  if (await handleFuzzyFileSearchSessionStopRoute(deps)) {
    return true;
  }
  if (await handleCommandExecRoute(deps)) {
    return true;
  }
  if (await handleConfigMcpServerReloadRoute(deps)) {
    return true;
  }
  if (await handleConfigBatchWriteRoute(deps)) {
    return true;
  }
  if (await handleConfigValueWriteRoute(deps)) {
    return true;
  }
  if (await handleMcpServerOauthLoginRoute(deps)) {
    return true;
  }
  if (await handleSkillsConfigWriteRoute(deps)) {
    return true;
  }
  if (await handleSkillsRemoteListRoute(deps)) {
    return true;
  }
  if (await handleSkillsRemoteExportRoute(deps)) {
    return true;
  }
  if (await handleExternalAgentConfigDetectRoute(deps)) {
    return true;
  }
  if (await handleExternalAgentConfigImportRoute(deps)) {
    return true;
  }
  if (await handleThreadRealtimeStartRoute(deps)) {
    return true;
  }
  if (await handleThreadRealtimeAppendAudioRoute(deps)) {
    return true;
  }
  if (await handleThreadRealtimeAppendTextRoute(deps)) {
    return true;
  }
  if (await handleThreadRealtimeStopRoute(deps)) {
    return true;
  }
  if (await handleWindowsSandboxSetupStartRoute(deps)) {
    return true;
  }
  if (await handleCapabilityCatalogRoutes(deps)) {
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

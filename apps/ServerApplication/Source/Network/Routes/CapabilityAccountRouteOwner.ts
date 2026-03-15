import type {
  AgentCancelAccountLoginResult,
  AgentId,
  AgentReadAccountRateLimitsResult,
  AgentReadAccountResult,
  AgentReadAuthStatusResult,
  AgentReadUserInfoResult,
  AgentStartAccountLoginResult,
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
  parseBooleanQueryValue,
  parseBooleanQueryValueStrict,
  toErrorMessage,
} from "./CapabilityRouteContracts.js";

type CapabilityAccountResponseBody = AgentReadAccountResult & {
  ok: true;
};

type CapabilityAccountAuthStatusResponseBody = AgentReadAuthStatusResult & {
  ok: true;
};

interface CapabilityAccountRateLimitsResponseBody {
  ok: true;
  rateLimits: AgentReadAccountRateLimitsResult["rateLimits"] | null;
  rateLimitsByLimitId: AgentReadAccountRateLimitsResult["rateLimitsByLimitId"];
}

type CapabilityAccountUserInfoResponseBody = AgentReadUserInfoResult & {
  ok: true;
};

type CapabilityAccountLoginStartResponseBody = AgentStartAccountLoginResult & {
  ok: true;
};

type CapabilityAccountLoginCancelResponseBody = AgentCancelAccountLoginResult & {
  ok: true;
};

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

function mapAccountResponse(result: AgentReadAccountResult): CapabilityAccountResponseBody {
  return {
    ok: true,
    ...result,
  };
}

function mapAccountAuthStatusResponse(
  result: AgentReadAuthStatusResult,
): CapabilityAccountAuthStatusResponseBody {
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

function mapAccountUserInfoResponse(
  result: AgentReadUserInfoResult,
): CapabilityAccountUserInfoResponseBody {
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

async function handleAccountRoute(deps: CapabilityRouteDependencies): Promise<boolean> {
  if (
    !isCapabilityRouteRequest(
      deps.req.method,
      deps.pathname,
      CapabilityRouteMethodByName.get,
      CapabilityRoutePathnameByName.account,
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
      account: null,
      requiresOpenaiAuth: false,
    });
    return true;
  }

  const adapter = deps.registry.getAdapter(resolvedAgentId);
  if (
    !adapter ||
    !adapter.isEnabled() ||
    !adapter.capabilities.canReadAccount ||
    !adapter.readAccount
  ) {
    deps.jsonResponse(deps.res, CapabilityRouteStatusCodeByName.success, {
      ok: true,
      account: null,
      requiresOpenaiAuth: false,
    });
    return true;
  }

  const refreshToken = parseBooleanQueryValue(
    deps.url.searchParams.get(CapabilityRouteQueryParameterByName.refreshToken),
  );

  try {
    const result = await deps.withTimeout(
      adapter.readAccount({
        refreshToken,
      }),
      deps.capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.accountRead,
    );
    deps.jsonResponse(
      deps.res,
      CapabilityRouteStatusCodeByName.success,
      mapAccountResponse(result),
    );
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        agentId: resolvedAgentId,
        error: message,
      },
      CapabilityRouteLogEventByName.accountReadFailed,
    );
    deps.jsonResponse(deps.res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToReadAccount}${message}`,
    });
  }

  return true;
}

async function handleAccountAuthStatusRoute(deps: CapabilityRouteDependencies): Promise<boolean> {
  if (
    !isCapabilityRouteRequest(
      deps.req.method,
      deps.pathname,
      CapabilityRouteMethodByName.get,
      CapabilityRoutePathnameByName.accountAuthStatus,
    )
  ) {
    return false;
  }

  const requestedAgentId = readRequestedAgentIdOrRespondBadRequest(deps);
  if (requestedAgentId === undefined) {
    return true;
  }

  const includeTokenRaw = deps.url.searchParams.get(
    CapabilityRouteQueryParameterByName.includeToken,
  );
  const includeToken = parseBooleanQueryValueStrict(includeTokenRaw);
  if (includeTokenRaw !== null && includeToken === null) {
    deps.jsonResponse(deps.res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidAccountAuthStatusIncludeToken,
    });
    return true;
  }

  const refreshTokenRaw = deps.url.searchParams.get(
    CapabilityRouteQueryParameterByName.refreshToken,
  );
  const refreshToken = parseBooleanQueryValueStrict(refreshTokenRaw);
  if (refreshTokenRaw !== null && refreshToken === null) {
    deps.jsonResponse(deps.res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.invalidAccountAuthStatusRefreshToken,
    });
    return true;
  }

  const resolvedAgentId = requestedAgentId ?? deps.registry.resolveDefaultAgentId();
  if (resolvedAgentId === null) {
    deps.jsonResponse(deps.res, CapabilityRouteStatusCodeByName.success, {
      ok: true,
      authMethod: null,
      authToken: null,
      requiresOpenaiAuth: null,
    });
    return true;
  }

  const adapter = deps.registry.getAdapter(resolvedAgentId);
  if (!adapter || !adapter.isEnabled() || !adapter.readAuthStatus) {
    deps.jsonResponse(deps.res, CapabilityRouteStatusCodeByName.success, {
      ok: true,
      authMethod: null,
      authToken: null,
      requiresOpenaiAuth: null,
    });
    return true;
  }

  try {
    const result = await deps.withTimeout(
      adapter.readAuthStatus({
        ...(includeToken !== null ? { includeToken } : {}),
        ...(refreshToken !== null ? { refreshToken } : {}),
      }),
      deps.capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.accountAuthStatusRead,
    );
    deps.jsonResponse(
      deps.res,
      CapabilityRouteStatusCodeByName.success,
      mapAccountAuthStatusResponse(result),
    );
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        agentId: resolvedAgentId,
        error: message,
      },
      CapabilityRouteLogEventByName.accountAuthStatusReadFailed,
    );
    deps.jsonResponse(deps.res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToReadAuthStatus}${message}`,
    });
  }

  return true;
}

async function handleAccountUserInfoRoute(deps: CapabilityRouteDependencies): Promise<boolean> {
  if (
    !isCapabilityRouteRequest(
      deps.req.method,
      deps.pathname,
      CapabilityRouteMethodByName.get,
      CapabilityRoutePathnameByName.accountUserInfo,
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
      allegedUserEmail: null,
    });
    return true;
  }

  const adapter = deps.registry.getAdapter(resolvedAgentId);
  if (!adapter || !adapter.isEnabled() || !adapter.readUserInfo) {
    deps.jsonResponse(deps.res, CapabilityRouteStatusCodeByName.success, {
      ok: true,
      allegedUserEmail: null,
    });
    return true;
  }

  try {
    const result = await deps.withTimeout(
      adapter.readUserInfo(),
      deps.capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.accountUserInfoRead,
    );
    deps.jsonResponse(
      deps.res,
      CapabilityRouteStatusCodeByName.success,
      mapAccountUserInfoResponse(result),
    );
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        agentId: resolvedAgentId,
        error: message,
      },
      CapabilityRouteLogEventByName.accountUserInfoReadFailed,
    );
    deps.jsonResponse(deps.res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToReadUserInfo}${message}`,
    });
  }

  return true;
}

async function handleAccountRateLimitsRoute(deps: CapabilityRouteDependencies): Promise<boolean> {
  if (
    !isCapabilityRouteRequest(
      deps.req.method,
      deps.pathname,
      CapabilityRouteMethodByName.get,
      CapabilityRoutePathnameByName.accountRateLimits,
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
      rateLimits: null,
      rateLimitsByLimitId: null,
    });
    return true;
  }

  const adapter = deps.registry.getAdapter(resolvedAgentId);
  if (
    !adapter ||
    !adapter.isEnabled() ||
    !adapter.capabilities.canReadAccountRateLimits ||
    !adapter.readAccountRateLimits
  ) {
    deps.jsonResponse(deps.res, CapabilityRouteStatusCodeByName.success, {
      ok: true,
      rateLimits: null,
      rateLimitsByLimitId: null,
    });
    return true;
  }

  try {
    const result = await deps.withTimeout(
      adapter.readAccountRateLimits(),
      deps.capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.accountRateLimitsRead,
    );
    deps.jsonResponse(
      deps.res,
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
    deps.jsonResponse(deps.res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToReadAccountRateLimits}${message}`,
    });
  }

  return true;
}

async function handleAccountLoginStartRoute(deps: CapabilityRouteDependencies): Promise<boolean> {
  if (
    !isCapabilityRouteRequest(
      deps.req.method,
      deps.pathname,
      CapabilityRouteMethodByName.post,
      CapabilityRoutePathnameByName.accountLoginStart,
    )
  ) {
    return false;
  }

  const requestedAgentId = readRequestedAgentIdOrRespondBadRequest(deps);
  if (requestedAgentId === undefined) {
    return true;
  }

  const resolvedAgentId = requestedAgentId ?? deps.registry.resolveDefaultAgentId();
  const adapter = resolvedAgentId === null ? null : deps.registry.getAdapter(resolvedAgentId);
  if (
    !adapter ||
    !adapter.isEnabled() ||
    !adapter.capabilities.canStartAccountLogin ||
    !adapter.startAccountLogin
  ) {
    deps.jsonResponse(deps.res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToStartAccountLogin}Account login is unavailable for the selected agent.`,
    });
    return true;
  }

  try {
    const result = await deps.withTimeout(
      adapter.startAccountLogin({
        type: "chatgpt",
      }),
      deps.capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.accountLoginStart,
    );
    deps.jsonResponse(
      deps.res,
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
    deps.jsonResponse(deps.res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToStartAccountLogin}${message}`,
    });
  }

  return true;
}

async function handleAccountLoginCancelRoute(deps: CapabilityRouteDependencies): Promise<boolean> {
  if (
    !isCapabilityRouteRequest(
      deps.req.method,
      deps.pathname,
      CapabilityRouteMethodByName.post,
      CapabilityRoutePathnameByName.accountLoginCancel,
    )
  ) {
    return false;
  }

  const requestedAgentId = readRequestedAgentIdOrRespondBadRequest(deps);
  if (requestedAgentId === undefined) {
    return true;
  }

  const loginIdRaw = deps.url.searchParams.get(CapabilityRouteQueryParameterByName.loginId);
  if (loginIdRaw === null || loginIdRaw.trim().length === 0) {
    deps.jsonResponse(deps.res, CapabilityRouteStatusCodeByName.badRequest, {
      ok: false,
      error: CapabilityRouteErrorMessagePrefixByName.missingLoginId,
    });
    return true;
  }

  const resolvedAgentId = requestedAgentId ?? deps.registry.resolveDefaultAgentId();
  const adapter = resolvedAgentId === null ? null : deps.registry.getAdapter(resolvedAgentId);
  if (
    !adapter ||
    !adapter.isEnabled() ||
    !adapter.capabilities.canCancelAccountLogin ||
    !adapter.cancelAccountLogin
  ) {
    deps.jsonResponse(deps.res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToCancelAccountLogin}Account login cancel is unavailable for the selected agent.`,
    });
    return true;
  }

  try {
    const result = await deps.withTimeout(
      adapter.cancelAccountLogin({
        loginId: loginIdRaw,
      }),
      deps.capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.accountLoginCancel,
    );
    deps.jsonResponse(
      deps.res,
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
    deps.jsonResponse(deps.res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToCancelAccountLogin}${message}`,
    });
  }

  return true;
}

async function handleAccountLogoutRoute(deps: CapabilityRouteDependencies): Promise<boolean> {
  if (
    !isCapabilityRouteRequest(
      deps.req.method,
      deps.pathname,
      CapabilityRouteMethodByName.post,
      CapabilityRoutePathnameByName.accountLogout,
    )
  ) {
    return false;
  }

  const requestedAgentId = readRequestedAgentIdOrRespondBadRequest(deps);
  if (requestedAgentId === undefined) {
    return true;
  }

  const resolvedAgentId = requestedAgentId ?? deps.registry.resolveDefaultAgentId();
  const adapter = resolvedAgentId === null ? null : deps.registry.getAdapter(resolvedAgentId);
  if (
    !adapter ||
    !adapter.isEnabled() ||
    !adapter.capabilities.canLogoutAccount ||
    !adapter.logoutAccount
  ) {
    deps.jsonResponse(deps.res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToLogoutAccount}Logout is unavailable for the selected agent.`,
    });
    return true;
  }

  try {
    await deps.withTimeout(
      adapter.logoutAccount(),
      deps.capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.accountLogout,
    );
    deps.jsonResponse(deps.res, CapabilityRouteStatusCodeByName.success, {
      ok: true,
    });
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        agentId: resolvedAgentId,
        error: message,
      },
      CapabilityRouteLogEventByName.accountLogoutFailed,
    );
    deps.jsonResponse(deps.res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToLogoutAccount}${message}`,
    });
  }

  return true;
}

/**
 * Owns account capability route dispatch for account state, auth status, and login lifecycle.
 * The routes share agent-resolution and auth-related query parsing rules.
 */
export async function handleCapabilityAccountRoutes(
  deps: CapabilityRouteDependencies,
): Promise<boolean> {
  if (await handleAccountRoute(deps)) {
    return true;
  }
  if (await handleAccountAuthStatusRoute(deps)) {
    return true;
  }
  if (await handleAccountRateLimitsRoute(deps)) {
    return true;
  }
  if (await handleAccountUserInfoRoute(deps)) {
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
  return false;
}

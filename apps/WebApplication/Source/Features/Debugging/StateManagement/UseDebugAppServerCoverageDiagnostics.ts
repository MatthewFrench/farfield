import { type JsonValue } from "@farfield/protocol";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CapabilityAccountLoginStartResponse,
  CapabilityAccountRateLimitsResponse,
  CapabilityAccountResponse,
  CapabilityAppsResponse,
  CapabilityConfigRequirementsResponse,
  CapabilityExperimentalFeaturesResponse,
  CapabilityMcpServersResponse,
  CapabilityServerClient,
  CapabilitySkillsResponse,
} from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import { type DebugWorkspaceSection } from "@/Features/Debugging/DomainModel/DebugWorkspaceSectionContracts";
import {
  type DebugAppServerCoverageAccount,
  type DebugAppServerCoverageAppSummary,
  type DebugAppServerCoverageExperimentalFeature,
  type DebugAppServerCoverageMcpServerSummary,
  type DebugAppServerCoveragePendingAccountLogin,
  type DebugAppServerCoverageRateLimitSnapshot,
  type DebugAppServerCoverageRequirements,
  type DebugAppServerCoverageSkillEntry,
  type DebugAppServerCoverageSnapshot,
} from "../DomainModel/DebugAppServerCoverageContracts";

const COVERAGE_WORKSPACE_SECTION: DebugWorkspaceSection = "coverage";

const COVERAGE_REQUEST_LIST_LIMIT = 100;
const COVERAGE_REQUEST_OPERATION_NAME = "debug-coverage-refresh";
const COVERAGE_MUTATION_OPERATION_NAME = "debug-coverage-action";
const COVERAGE_ERROR_PREFIX = "Unable to load app-server coverage diagnostics: ";
const COVERAGE_ACTION_ERROR_PREFIX = "Unable to run coverage action: ";

export interface UseDebugAppServerCoverageDiagnosticsInput {
  debugWorkspaceSection: DebugWorkspaceSection;
  capabilityServerClient: CapabilityServerClient;
}

export interface DebugAppServerCoverageDiagnostics {
  isLoadingCoverageDiagnostics: boolean;
  isRunningCoverageAction: boolean;
  coverageDiagnosticsErrorMessage: string;
  coverageActionErrorMessage: string;
  coverageDiagnosticsSnapshot: DebugAppServerCoverageSnapshot | null;
  pendingAccountLogin: DebugAppServerCoveragePendingAccountLogin | null;
  refreshCoverageDiagnostics: () => void;
  startAccountLogin: () => void;
  cancelAccountLogin: () => void;
  logoutAccount: () => void;
  reloadMcpServerConfig: () => void;
  startMcpServerOauthLogin: (serverName: string) => void;
  writeSkillsConfig: (skillPath: string, enabled: boolean) => void;
}

function toErrorMessage<ErrorType>(error: ErrorType): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}

function readAuthStatusLabel(authStatus: JsonValue): string {
  if (typeof authStatus === "string") {
    return authStatus;
  }
  if (authStatus === null) {
    return "null";
  }
  return JSON.stringify(authStatus);
}

function mapRequirements(
  requirements: CapabilityConfigRequirementsResponse["requirements"],
): DebugAppServerCoverageRequirements | null {
  if (requirements === null) {
    return null;
  }
  return {
    allowedApprovalPolicies: requirements.allowedApprovalPolicies,
    allowedSandboxModes: requirements.allowedSandboxModes,
    allowedWebSearchModes: requirements.allowedWebSearchModes,
    enforceResidency: requirements.enforceResidency,
    network: requirements.network,
  };
}

function mapAccount(
  account: CapabilityAccountResponse["account"],
): DebugAppServerCoverageAccount | null {
  if (account === null) {
    return null;
  }
  if (account.type === "apiKey") {
    return {
      type: "apiKey",
    };
  }
  return {
    type: "chatgpt",
    email: account.email,
    planType: account.planType,
  };
}

function mapRateLimitSnapshot(
  snapshot: CapabilityAccountRateLimitsResponse["rateLimits"],
): DebugAppServerCoverageRateLimitSnapshot | null {
  if (snapshot === null) {
    return null;
  }
  return {
    credits: snapshot.credits,
    limitId: snapshot.limitId,
    limitName: snapshot.limitName,
    planType: snapshot.planType,
    primary: snapshot.primary,
    secondary: snapshot.secondary,
  };
}

function mapPendingAccountLogin(
  response: CapabilityAccountLoginStartResponse,
): DebugAppServerCoveragePendingAccountLogin | null {
  if (response.type !== "chatgpt") {
    return null;
  }
  return {
    loginId: response.loginId,
    authUrl: response.authUrl,
  };
}

function mapExperimentalFeatures(
  data: CapabilityExperimentalFeaturesResponse["data"],
): DebugAppServerCoverageExperimentalFeature[] {
  return data.map((feature) => ({
    name: feature.name,
    stage: feature.stage,
    displayName: feature.displayName,
    description: feature.description,
    announcement: feature.announcement,
    enabled: feature.enabled,
    defaultEnabled: feature.defaultEnabled,
  }));
}

function mapMcpServers(
  data: CapabilityMcpServersResponse["data"],
): DebugAppServerCoverageMcpServerSummary[] {
  return data.map((server) => ({
    name: server.name,
    authStatus: readAuthStatusLabel(server.authStatus),
    toolCount: server.toolCount,
    resourceCount: server.resourceCount,
    resourceTemplateCount: server.resourceTemplateCount,
  }));
}

function mapApps(data: CapabilityAppsResponse["data"]): DebugAppServerCoverageAppSummary[] {
  return data.map((appInfo) => ({
    id: appInfo.id,
    name: appInfo.name,
    description: appInfo.description,
    isAccessible: appInfo.isAccessible,
    isEnabled: appInfo.isEnabled,
  }));
}

function mapSkills(data: CapabilitySkillsResponse["data"]): DebugAppServerCoverageSkillEntry[] {
  return data.map((entry) => ({
    cwd: entry.cwd,
    skills: entry.skills.map((skill) => ({
      name: skill.name,
      description: skill.description,
      path: skill.path,
      scope: skill.scope,
      enabled: skill.enabled,
    })),
    errorCount: entry.errors.length,
  }));
}

/**
 * Owns read cadence for app-server coverage diagnostics rendered in Debug Workspace.
 * Request concurrency is sequenced with request serials so stale responses cannot overwrite fresh state.
 */
export function useDebugAppServerCoverageDiagnostics(
  input: UseDebugAppServerCoverageDiagnosticsInput,
): DebugAppServerCoverageDiagnostics {
  const [isLoadingCoverageDiagnostics, setIsLoadingCoverageDiagnostics] = useState(false);
  const [isRunningCoverageAction, setIsRunningCoverageAction] = useState(false);
  const [coverageDiagnosticsErrorMessage, setCoverageDiagnosticsErrorMessage] = useState("");
  const [coverageActionErrorMessage, setCoverageActionErrorMessage] = useState("");
  const [coverageDiagnosticsSnapshot, setCoverageDiagnosticsSnapshot] =
    useState<DebugAppServerCoverageSnapshot | null>(null);
  const [pendingAccountLogin, setPendingAccountLogin] =
    useState<DebugAppServerCoveragePendingAccountLogin | null>(null);
  const requestSerialRef = useRef(0);

  const refreshCoverageDiagnostics = useCallback(() => {
    const nextRequestSerial = requestSerialRef.current + 1;
    requestSerialRef.current = nextRequestSerial;
    setIsLoadingCoverageDiagnostics(true);
    setCoverageDiagnosticsErrorMessage("");

    void (async () => {
      try {
        const [
          configRequirementsResponse,
          accountResponse,
          accountRateLimitsResponse,
          experimentalFeaturesResponse,
          mcpServersResponse,
          appsResponse,
          skillsResponse,
        ] = await Promise.all([
          input.capabilityServerClient.readConfigRequirements({
            actionName: COVERAGE_REQUEST_OPERATION_NAME,
          }),
          input.capabilityServerClient.readAccount({
            actionName: COVERAGE_REQUEST_OPERATION_NAME,
          }),
          input.capabilityServerClient.readAccountRateLimits({
            actionName: COVERAGE_REQUEST_OPERATION_NAME,
          }),
          input.capabilityServerClient.listExperimentalFeatures({
            actionName: COVERAGE_REQUEST_OPERATION_NAME,
            limit: COVERAGE_REQUEST_LIST_LIMIT,
          }),
          input.capabilityServerClient.listMcpServers({
            actionName: COVERAGE_REQUEST_OPERATION_NAME,
            limit: COVERAGE_REQUEST_LIST_LIMIT,
          }),
          input.capabilityServerClient.listApps({
            actionName: COVERAGE_REQUEST_OPERATION_NAME,
            limit: COVERAGE_REQUEST_LIST_LIMIT,
          }),
          input.capabilityServerClient.listSkills({
            actionName: COVERAGE_REQUEST_OPERATION_NAME,
          }),
        ]);

        if (requestSerialRef.current !== nextRequestSerial) {
          return;
        }

        setCoverageDiagnosticsSnapshot({
          requirements: mapRequirements(configRequirementsResponse.requirements),
          account: mapAccount(accountResponse.account),
          requiresOpenaiAuth: accountResponse.requiresOpenaiAuth,
          accountRateLimits: mapRateLimitSnapshot(accountRateLimitsResponse.rateLimits),
          experimentalFeatures: mapExperimentalFeatures(experimentalFeaturesResponse.data),
          mcpServers: mapMcpServers(mcpServersResponse.data),
          apps: mapApps(appsResponse.data),
          skills: mapSkills(skillsResponse.data),
          refreshedAtIso8601: new Date().toISOString(),
        });
        if (accountResponse.account !== null) {
          setPendingAccountLogin(null);
        }
      } catch (error) {
        if (requestSerialRef.current !== nextRequestSerial) {
          return;
        }
        setCoverageDiagnosticsErrorMessage(`${COVERAGE_ERROR_PREFIX}${toErrorMessage(error)}`);
      } finally {
        if (requestSerialRef.current === nextRequestSerial) {
          setIsLoadingCoverageDiagnostics(false);
        }
      }
    })();
  }, [input.capabilityServerClient]);

  const startAccountLogin = useCallback(() => {
    if (isRunningCoverageAction) {
      return;
    }
    setIsRunningCoverageAction(true);
    setCoverageActionErrorMessage("");

    void (async () => {
      try {
        const response = await input.capabilityServerClient.startAccountLogin({
          actionName: COVERAGE_MUTATION_OPERATION_NAME,
        });
        setPendingAccountLogin(mapPendingAccountLogin(response));
        refreshCoverageDiagnostics();
      } catch (error) {
        setCoverageActionErrorMessage(`${COVERAGE_ACTION_ERROR_PREFIX}${toErrorMessage(error)}`);
      } finally {
        setIsRunningCoverageAction(false);
      }
    })();
  }, [input.capabilityServerClient, isRunningCoverageAction, refreshCoverageDiagnostics]);

  const cancelAccountLogin = useCallback(() => {
    if (isRunningCoverageAction || pendingAccountLogin === null) {
      return;
    }
    setIsRunningCoverageAction(true);
    setCoverageActionErrorMessage("");

    void (async () => {
      try {
        await input.capabilityServerClient.cancelAccountLogin({
          loginId: pendingAccountLogin.loginId,
          actionName: COVERAGE_MUTATION_OPERATION_NAME,
        });
        setPendingAccountLogin(null);
        refreshCoverageDiagnostics();
      } catch (error) {
        setCoverageActionErrorMessage(`${COVERAGE_ACTION_ERROR_PREFIX}${toErrorMessage(error)}`);
      } finally {
        setIsRunningCoverageAction(false);
      }
    })();
  }, [
    input.capabilityServerClient,
    isRunningCoverageAction,
    pendingAccountLogin,
    refreshCoverageDiagnostics,
  ]);

  const logoutAccount = useCallback(() => {
    if (isRunningCoverageAction) {
      return;
    }
    setIsRunningCoverageAction(true);
    setCoverageActionErrorMessage("");

    void (async () => {
      try {
        await input.capabilityServerClient.logoutAccount({
          actionName: COVERAGE_MUTATION_OPERATION_NAME,
        });
        setPendingAccountLogin(null);
        refreshCoverageDiagnostics();
      } catch (error) {
        setCoverageActionErrorMessage(`${COVERAGE_ACTION_ERROR_PREFIX}${toErrorMessage(error)}`);
      } finally {
        setIsRunningCoverageAction(false);
      }
    })();
  }, [input.capabilityServerClient, isRunningCoverageAction, refreshCoverageDiagnostics]);

  const reloadMcpServerConfig = useCallback(() => {
    if (isRunningCoverageAction) {
      return;
    }
    setIsRunningCoverageAction(true);
    setCoverageActionErrorMessage("");

    void (async () => {
      try {
        await input.capabilityServerClient.reloadMcpServerConfig({
          actionName: COVERAGE_MUTATION_OPERATION_NAME,
        });
        refreshCoverageDiagnostics();
      } catch (error) {
        setCoverageActionErrorMessage(`${COVERAGE_ACTION_ERROR_PREFIX}${toErrorMessage(error)}`);
      } finally {
        setIsRunningCoverageAction(false);
      }
    })();
  }, [input.capabilityServerClient, isRunningCoverageAction, refreshCoverageDiagnostics]);

  const startMcpServerOauthLogin = useCallback(
    (serverName: string) => {
      if (isRunningCoverageAction) {
        return;
      }
      if (serverName.trim().length === 0) {
        return;
      }
      setIsRunningCoverageAction(true);
      setCoverageActionErrorMessage("");

      void (async () => {
        try {
          const response = await input.capabilityServerClient.startMcpServerOauthLogin({
            actionName: COVERAGE_MUTATION_OPERATION_NAME,
            name: serverName,
          });
          if (typeof window.open === "function") {
            window.open(response.authorizationUrl, "_blank", "noopener,noreferrer");
          }
          refreshCoverageDiagnostics();
        } catch (error) {
          setCoverageActionErrorMessage(`${COVERAGE_ACTION_ERROR_PREFIX}${toErrorMessage(error)}`);
        } finally {
          setIsRunningCoverageAction(false);
        }
      })();
    },
    [input.capabilityServerClient, isRunningCoverageAction, refreshCoverageDiagnostics],
  );

  const writeSkillsConfig = useCallback(
    (skillPath: string, enabled: boolean) => {
      if (isRunningCoverageAction) {
        return;
      }
      if (skillPath.trim().length === 0) {
        return;
      }
      setIsRunningCoverageAction(true);
      setCoverageActionErrorMessage("");

      void (async () => {
        try {
          await input.capabilityServerClient.writeSkillsConfig({
            actionName: COVERAGE_MUTATION_OPERATION_NAME,
            path: skillPath,
            enabled,
          });
          refreshCoverageDiagnostics();
        } catch (error) {
          setCoverageActionErrorMessage(`${COVERAGE_ACTION_ERROR_PREFIX}${toErrorMessage(error)}`);
        } finally {
          setIsRunningCoverageAction(false);
        }
      })();
    },
    [input.capabilityServerClient, isRunningCoverageAction, refreshCoverageDiagnostics],
  );

  useEffect(() => {
    if (input.debugWorkspaceSection !== COVERAGE_WORKSPACE_SECTION) {
      return;
    }
    if (isLoadingCoverageDiagnostics || coverageDiagnosticsSnapshot !== null) {
      return;
    }
    refreshCoverageDiagnostics();
  }, [
    coverageDiagnosticsSnapshot,
    input.debugWorkspaceSection,
    isLoadingCoverageDiagnostics,
    refreshCoverageDiagnostics,
  ]);

  return {
    isLoadingCoverageDiagnostics,
    isRunningCoverageAction,
    coverageDiagnosticsErrorMessage,
    coverageActionErrorMessage,
    coverageDiagnosticsSnapshot,
    pendingAccountLogin,
    refreshCoverageDiagnostics,
    startAccountLogin,
    cancelAccountLogin,
    logoutAccount,
    reloadMcpServerConfig,
    startMcpServerOauthLogin,
    writeSkillsConfig,
  };
}

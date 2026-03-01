import { type JsonValue, JsonValueSchema } from "@farfield/protocol";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CapabilityConfigWriteMergeStrategy,
  CapabilityServerClient,
} from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import { type DebugWorkspaceSection } from "@/Features/Debugging/DomainModel/DebugWorkspaceSectionContracts";
import {
  type DebugAppServerCoverageCommandExecutionResult,
  type DebugAppServerCoverageConfigValueWriteResult,
  type DebugAppServerCoveragePendingAccountLogin,
  type DebugAppServerCoverageSnapshot,
} from "../DomainModel/DebugAppServerCoverageContracts";
import {
  mapAccount,
  mapApps,
  mapCommandExecutionResult,
  mapConfigValueWriteResult,
  mapExperimentalFeatures,
  mapMcpServers,
  mapPendingAccountLogin,
  mapRateLimitSnapshot,
  mapRemoteSkills,
  mapRequirements,
  mapSkills,
} from "./DebugAppServerCoverageDiagnosticsMappers";

const COVERAGE_WORKSPACE_SECTION: DebugWorkspaceSection = "coverage";

const COVERAGE_REQUEST_LIST_LIMIT = 100;
const COVERAGE_REQUEST_OPERATION_NAME = "debug-coverage-refresh";
const COVERAGE_MUTATION_OPERATION_NAME = "debug-coverage-action";
const COVERAGE_ERROR_PREFIX = "Unable to load app-server coverage diagnostics: ";
const COVERAGE_ACTION_ERROR_PREFIX = "Unable to run coverage action: ";
const COVERAGE_REMOTE_SKILLS_HAZELNUT_SCOPE = "personal";
const COVERAGE_REMOTE_SKILLS_PRODUCT_SURFACE = "codex";
const COVERAGE_REMOTE_SKILLS_ENABLED = true;

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
  lastCommandExecutionResult: DebugAppServerCoverageCommandExecutionResult | null;
  lastConfigValueWriteResult: DebugAppServerCoverageConfigValueWriteResult | null;
  refreshCoverageDiagnostics: () => void;
  startAccountLogin: () => void;
  cancelAccountLogin: () => void;
  logoutAccount: () => void;
  reloadMcpServerConfig: () => void;
  startMcpServerOauthLogin: (serverName: string) => void;
  writeConfigValue: (
    keyPath: string,
    value: string,
    mergeStrategy: CapabilityConfigWriteMergeStrategy,
    filePath?: string,
    expectedVersion?: string,
  ) => void;
  writeSkillsConfig: (skillPath: string, enabled: boolean) => void;
  exportRemoteSkill: (hazelnutId: string) => void;
  executeCommand: (command: string[], timeoutMs?: number, cwd?: string) => void;
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
  const [lastCommandExecutionResult, setLastCommandExecutionResult] =
    useState<DebugAppServerCoverageCommandExecutionResult | null>(null);
  const [lastConfigValueWriteResult, setLastConfigValueWriteResult] =
    useState<DebugAppServerCoverageConfigValueWriteResult | null>(null);
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
          remoteSkillsResponse,
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
          input.capabilityServerClient.listRemoteSkills({
            actionName: COVERAGE_REQUEST_OPERATION_NAME,
            hazelnutScope: COVERAGE_REMOTE_SKILLS_HAZELNUT_SCOPE,
            productSurface: COVERAGE_REMOTE_SKILLS_PRODUCT_SURFACE,
            enabled: COVERAGE_REMOTE_SKILLS_ENABLED,
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
          remoteSkills: mapRemoteSkills(remoteSkillsResponse.data),
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

  const writeConfigValue = useCallback(
    (
      keyPath: string,
      value: string,
      mergeStrategy: CapabilityConfigWriteMergeStrategy,
      filePath?: string,
      expectedVersion?: string,
    ) => {
      if (isRunningCoverageAction) {
        return;
      }

      const normalizedKeyPath = keyPath.trim();
      if (normalizedKeyPath.length === 0) {
        return;
      }

      const normalizedValue = value.trim();
      if (normalizedValue.length === 0) {
        setCoverageActionErrorMessage(
          `${COVERAGE_ACTION_ERROR_PREFIX}Config value must be valid JSON.`,
        );
        return;
      }

      let parsedValue: JsonValue;
      try {
        parsedValue = JsonValueSchema.parse(JSON.parse(normalizedValue));
      } catch {
        setCoverageActionErrorMessage(
          `${COVERAGE_ACTION_ERROR_PREFIX}Config value must be valid JSON.`,
        );
        return;
      }

      const normalizedFilePath = filePath?.trim();
      const normalizedExpectedVersion = expectedVersion?.trim();

      setIsRunningCoverageAction(true);
      setCoverageActionErrorMessage("");

      void (async () => {
        try {
          const response = await input.capabilityServerClient.writeConfigValue({
            actionName: COVERAGE_MUTATION_OPERATION_NAME,
            keyPath: normalizedKeyPath,
            value: parsedValue,
            mergeStrategy,
            ...(normalizedFilePath !== undefined && normalizedFilePath.length > 0
              ? { filePath: normalizedFilePath }
              : {}),
            ...(normalizedExpectedVersion !== undefined && normalizedExpectedVersion.length > 0
              ? { expectedVersion: normalizedExpectedVersion }
              : {}),
          });
          setLastConfigValueWriteResult(
            mapConfigValueWriteResult(response, normalizedKeyPath, mergeStrategy, parsedValue),
          );
        } catch (error) {
          setCoverageActionErrorMessage(`${COVERAGE_ACTION_ERROR_PREFIX}${toErrorMessage(error)}`);
        } finally {
          setIsRunningCoverageAction(false);
        }
      })();
    },
    [input.capabilityServerClient, isRunningCoverageAction],
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

  const exportRemoteSkill = useCallback(
    (hazelnutId: string) => {
      if (isRunningCoverageAction) {
        return;
      }
      if (hazelnutId.trim().length === 0) {
        return;
      }
      setIsRunningCoverageAction(true);
      setCoverageActionErrorMessage("");

      void (async () => {
        try {
          await input.capabilityServerClient.exportRemoteSkill({
            actionName: COVERAGE_MUTATION_OPERATION_NAME,
            hazelnutId,
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

  const executeCommand = useCallback(
    (command: string[], timeoutMs?: number, cwd?: string) => {
      if (isRunningCoverageAction) {
        return;
      }
      if (command.length === 0) {
        return;
      }
      const normalizedCommand = command.map((entry) => entry.trim());
      if (normalizedCommand.some((entry) => entry.length === 0)) {
        return;
      }
      const normalizedWorkingDirectory = cwd?.trim();
      if (
        cwd !== undefined &&
        normalizedWorkingDirectory !== undefined &&
        normalizedWorkingDirectory.length === 0
      ) {
        return;
      }

      setIsRunningCoverageAction(true);
      setCoverageActionErrorMessage("");

      void (async () => {
        try {
          const response = await input.capabilityServerClient.executeCommand({
            actionName: COVERAGE_MUTATION_OPERATION_NAME,
            command: normalizedCommand,
            ...(timeoutMs !== undefined ? { timeoutMs } : {}),
            ...(normalizedWorkingDirectory !== undefined
              ? { cwd: normalizedWorkingDirectory }
              : {}),
          });
          setLastCommandExecutionResult(mapCommandExecutionResult(response, normalizedCommand));
        } catch (error) {
          setCoverageActionErrorMessage(`${COVERAGE_ACTION_ERROR_PREFIX}${toErrorMessage(error)}`);
        } finally {
          setIsRunningCoverageAction(false);
        }
      })();
    },
    [input.capabilityServerClient, isRunningCoverageAction],
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
    lastCommandExecutionResult,
    lastConfigValueWriteResult,
    refreshCoverageDiagnostics,
    startAccountLogin,
    cancelAccountLogin,
    logoutAccount,
    reloadMcpServerConfig,
    startMcpServerOauthLogin,
    writeConfigValue,
    writeSkillsConfig,
    exportRemoteSkill,
    executeCommand,
  };
}

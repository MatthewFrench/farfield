import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  CapabilityConfigWriteMergeStrategy,
  CapabilityServerClient,
} from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import { type DebugWorkspaceSection } from "@/Features/Debugging/DomainModel/DebugWorkspaceSectionContracts";
import {
  type DebugAppServerCoverageCommandExecutionResult,
  type DebugAppServerCoverageConfigBatchWriteResult,
  type DebugAppServerCoverageConfigValueWriteResult,
  type DebugAppServerCoverageExternalAgentConfigDetectResult,
  type DebugAppServerCoverageExternalAgentConfigImportResult,
  type DebugAppServerCoverageExternalAgentConfigMigrationItem,
  type DebugAppServerCoverageFeedbackUploadResult,
  type DebugAppServerCoverageFuzzyFileSearchResult,
  type DebugAppServerCoverageGitDiffToRemoteResult,
  type DebugAppServerCoveragePendingAccountLogin,
  type DebugAppServerCoverageSnapshot,
} from "../DomainModel/DebugAppServerCoverageContracts";
import {
  runConfigBatchWriteAction,
  runConfigValueWriteAction,
} from "./DebugAppServerCoverageConfigWriteActionRunners";
import {
  mapAccount,
  mapApps,
  mapAuthStatus,
  mapExperimentalFeatures,
  mapMcpServers,
  mapPendingAccountLogin,
  mapRateLimitSnapshot,
  mapRemoteSkills,
  mapRequirements,
  mapSkills,
  mapUserInfo,
} from "./DebugAppServerCoverageDiagnosticsMappers";
import {
  runCommandExecutionAction,
  runExternalAgentConfigDetectAction,
  runExternalAgentConfigImportAction,
  runFeedbackUploadAction,
  runFuzzyFileSearchAction,
  runGitDiffToRemoteAction,
} from "./DebugAppServerCoverageMutationActionRunners";

const COVERAGE_WORKSPACE_SECTION: DebugWorkspaceSection = "coverage";

const COVERAGE_REQUEST_LIST_LIMIT = 100;
const COVERAGE_REQUEST_OPERATION_NAME = "debug-coverage-refresh";
const COVERAGE_MUTATION_OPERATION_NAME = "debug-coverage-action";
const COVERAGE_ERROR_PREFIX = "Unable to load app-server coverage diagnostics: ";
const COVERAGE_ACTION_ERROR_PREFIX = "Unable to run coverage action: ";
const COVERAGE_REMOTE_SKILLS_HAZELNUT_SCOPE = "personal";
const COVERAGE_REMOTE_SKILLS_PRODUCT_SURFACE = "codex";
const COVERAGE_REMOTE_SKILLS_ENABLED = true;
const COVERAGE_AUTH_STATUS_INCLUDE_TOKEN = false;
const COVERAGE_AUTH_STATUS_REFRESH_TOKEN = false;

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
  lastConfigBatchWriteResult: DebugAppServerCoverageConfigBatchWriteResult | null;
  lastConfigValueWriteResult: DebugAppServerCoverageConfigValueWriteResult | null;
  lastExternalAgentConfigDetectResult: DebugAppServerCoverageExternalAgentConfigDetectResult | null;
  lastExternalAgentConfigImportResult: DebugAppServerCoverageExternalAgentConfigImportResult | null;
  lastFeedbackUploadResult: DebugAppServerCoverageFeedbackUploadResult | null;
  lastFuzzyFileSearchResult: DebugAppServerCoverageFuzzyFileSearchResult | null;
  lastGitDiffToRemoteResult: DebugAppServerCoverageGitDiffToRemoteResult | null;
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
  writeConfigBatch: (edits: string, filePath?: string, expectedVersion?: string) => void;
  writeSkillsConfig: (skillPath: string, enabled: boolean) => void;
  exportRemoteSkill: (hazelnutId: string) => void;
  detectExternalAgentConfig: (includeHome: boolean, cwds: string[]) => void;
  importExternalAgentConfig: (
    migrationItems: DebugAppServerCoverageExternalAgentConfigMigrationItem[],
  ) => void;
  readGitDiffToRemote: (cwd: string) => void;
  searchFuzzyFiles: (query: string, roots: string[], cancellationToken?: string) => void;
  executeCommand: (command: string[], timeoutMs?: number, cwd?: string) => void;
  uploadFeedback: (
    classification: string,
    includeLogs: boolean,
    reason?: string,
    threadId?: string,
  ) => void;
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

interface RunCoverageDiagnosticsRefreshInput {
  capabilityServerClient: CapabilityServerClient;
  requestSerialRef: MutableRefObject<number>;
  setIsLoadingCoverageDiagnostics: Dispatch<SetStateAction<boolean>>;
  setCoverageDiagnosticsErrorMessage: Dispatch<SetStateAction<string>>;
  setCoverageDiagnosticsSnapshot: Dispatch<SetStateAction<DebugAppServerCoverageSnapshot | null>>;
  setPendingAccountLogin: Dispatch<
    SetStateAction<DebugAppServerCoveragePendingAccountLogin | null>
  >;
}

function runCoverageDiagnosticsRefresh(input: RunCoverageDiagnosticsRefreshInput): void {
  const requestSerialReference = input.requestSerialRef;
  const nextRequestSerial = requestSerialReference.current + 1;
  requestSerialReference.current = nextRequestSerial;
  input.setIsLoadingCoverageDiagnostics(true);
  input.setCoverageDiagnosticsErrorMessage("");

  void (async () => {
    try {
      const [
        configRequirementsResponse,
        accountResponse,
        authStatusResponse,
        accountRateLimitsResponse,
        userInfoResponse,
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
        input.capabilityServerClient.readAuthStatus({
          actionName: COVERAGE_REQUEST_OPERATION_NAME,
          includeToken: COVERAGE_AUTH_STATUS_INCLUDE_TOKEN,
          refreshToken: COVERAGE_AUTH_STATUS_REFRESH_TOKEN,
        }),
        input.capabilityServerClient.readAccountRateLimits({
          actionName: COVERAGE_REQUEST_OPERATION_NAME,
        }),
        input.capabilityServerClient.readUserInfo({
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

      if (requestSerialReference.current !== nextRequestSerial) {
        return;
      }

      input.setCoverageDiagnosticsSnapshot({
        requirements: mapRequirements(configRequirementsResponse.requirements),
        account: mapAccount(accountResponse.account),
        requiresOpenaiAuth: accountResponse.requiresOpenaiAuth,
        authStatus: mapAuthStatus(authStatusResponse),
        accountRateLimits: mapRateLimitSnapshot(accountRateLimitsResponse.rateLimits),
        userInfo: mapUserInfo(userInfoResponse),
        experimentalFeatures: mapExperimentalFeatures(experimentalFeaturesResponse.data),
        mcpServers: mapMcpServers(mcpServersResponse.data),
        apps: mapApps(appsResponse.data),
        skills: mapSkills(skillsResponse.data),
        remoteSkills: mapRemoteSkills(remoteSkillsResponse.data),
        refreshedAtIso8601: new Date().toISOString(),
      });
      if (accountResponse.account !== null) {
        input.setPendingAccountLogin(null);
      }
    } catch (error) {
      if (requestSerialReference.current !== nextRequestSerial) {
        return;
      }
      input.setCoverageDiagnosticsErrorMessage(`${COVERAGE_ERROR_PREFIX}${toErrorMessage(error)}`);
    } finally {
      if (requestSerialReference.current === nextRequestSerial) {
        input.setIsLoadingCoverageDiagnostics(false);
      }
    }
  })();
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
  const [lastConfigBatchWriteResult, setLastConfigBatchWriteResult] =
    useState<DebugAppServerCoverageConfigBatchWriteResult | null>(null);
  const [lastConfigValueWriteResult, setLastConfigValueWriteResult] =
    useState<DebugAppServerCoverageConfigValueWriteResult | null>(null);
  const [lastExternalAgentConfigDetectResult, setLastExternalAgentConfigDetectResult] =
    useState<DebugAppServerCoverageExternalAgentConfigDetectResult | null>(null);
  const [lastExternalAgentConfigImportResult, setLastExternalAgentConfigImportResult] =
    useState<DebugAppServerCoverageExternalAgentConfigImportResult | null>(null);
  const [lastFeedbackUploadResult, setLastFeedbackUploadResult] =
    useState<DebugAppServerCoverageFeedbackUploadResult | null>(null);
  const [lastFuzzyFileSearchResult, setLastFuzzyFileSearchResult] =
    useState<DebugAppServerCoverageFuzzyFileSearchResult | null>(null);
  const [lastGitDiffToRemoteResult, setLastGitDiffToRemoteResult] =
    useState<DebugAppServerCoverageGitDiffToRemoteResult | null>(null);
  const requestSerialRef = useRef(0);

  const refreshCoverageDiagnostics = useCallback(() => {
    runCoverageDiagnosticsRefresh({
      capabilityServerClient: input.capabilityServerClient,
      requestSerialRef,
      setIsLoadingCoverageDiagnostics,
      setCoverageDiagnosticsErrorMessage,
      setCoverageDiagnosticsSnapshot,
      setPendingAccountLogin,
    });
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
      runConfigValueWriteAction({
        capabilityServerClient: input.capabilityServerClient,
        isRunningCoverageAction,
        keyPath,
        value,
        mergeStrategy,
        ...(filePath !== undefined ? { filePath } : {}),
        ...(expectedVersion !== undefined ? { expectedVersion } : {}),
        setIsRunningCoverageAction,
        setCoverageActionErrorMessage,
        setLastConfigValueWriteResult,
      });
    },
    [input.capabilityServerClient, isRunningCoverageAction],
  );

  const writeConfigBatch = useCallback(
    (edits: string, filePath?: string, expectedVersion?: string) => {
      runConfigBatchWriteAction({
        capabilityServerClient: input.capabilityServerClient,
        isRunningCoverageAction,
        edits,
        ...(filePath !== undefined ? { filePath } : {}),
        ...(expectedVersion !== undefined ? { expectedVersion } : {}),
        setIsRunningCoverageAction,
        setCoverageActionErrorMessage,
        setLastConfigBatchWriteResult,
      });
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

  const detectExternalAgentConfig = useCallback(
    (includeHome: boolean, cwds: string[]) => {
      runExternalAgentConfigDetectAction({
        capabilityServerClient: input.capabilityServerClient,
        isRunningCoverageAction,
        includeHome,
        cwds,
        setIsRunningCoverageAction,
        setCoverageActionErrorMessage,
        setLastExternalAgentConfigDetectResult,
      });
    },
    [input.capabilityServerClient, isRunningCoverageAction],
  );

  const importExternalAgentConfig = useCallback(
    (migrationItems: DebugAppServerCoverageExternalAgentConfigMigrationItem[]) => {
      runExternalAgentConfigImportAction({
        capabilityServerClient: input.capabilityServerClient,
        isRunningCoverageAction,
        migrationItems,
        setIsRunningCoverageAction,
        setCoverageActionErrorMessage,
        setLastExternalAgentConfigImportResult,
      });
    },
    [input.capabilityServerClient, isRunningCoverageAction],
  );

  const readGitDiffToRemote = useCallback(
    (cwd: string) => {
      runGitDiffToRemoteAction({
        capabilityServerClient: input.capabilityServerClient,
        isRunningCoverageAction,
        cwd,
        setIsRunningCoverageAction,
        setCoverageActionErrorMessage,
        setLastGitDiffToRemoteResult,
      });
    },
    [input.capabilityServerClient, isRunningCoverageAction],
  );

  const searchFuzzyFiles = useCallback(
    (query: string, roots: string[], cancellationToken?: string) => {
      runFuzzyFileSearchAction({
        capabilityServerClient: input.capabilityServerClient,
        isRunningCoverageAction,
        query,
        roots,
        ...(cancellationToken !== undefined ? { cancellationToken } : {}),
        setIsRunningCoverageAction,
        setCoverageActionErrorMessage,
        setLastFuzzyFileSearchResult,
      });
    },
    [input.capabilityServerClient, isRunningCoverageAction],
  );

  const executeCommand = useCallback(
    (command: string[], timeoutMs?: number, cwd?: string) => {
      runCommandExecutionAction({
        capabilityServerClient: input.capabilityServerClient,
        isRunningCoverageAction,
        command,
        ...(timeoutMs !== undefined ? { timeoutMs } : {}),
        ...(cwd !== undefined ? { cwd } : {}),
        setIsRunningCoverageAction,
        setCoverageActionErrorMessage,
        setLastCommandExecutionResult,
      });
    },
    [input.capabilityServerClient, isRunningCoverageAction],
  );

  const uploadFeedback = useCallback(
    (classification: string, includeLogs: boolean, reason?: string, threadId?: string) => {
      runFeedbackUploadAction({
        capabilityServerClient: input.capabilityServerClient,
        isRunningCoverageAction,
        classification,
        includeLogs,
        ...(reason !== undefined ? { reason } : {}),
        ...(threadId !== undefined ? { threadId } : {}),
        setIsRunningCoverageAction,
        setCoverageActionErrorMessage,
        setLastFeedbackUploadResult,
      });
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
    lastConfigBatchWriteResult,
    lastConfigValueWriteResult,
    lastExternalAgentConfigDetectResult,
    lastExternalAgentConfigImportResult,
    lastFeedbackUploadResult,
    lastFuzzyFileSearchResult,
    lastGitDiffToRemoteResult,
    refreshCoverageDiagnostics,
    startAccountLogin,
    cancelAccountLogin,
    logoutAccount,
    reloadMcpServerConfig,
    startMcpServerOauthLogin,
    writeConfigValue,
    writeConfigBatch,
    writeSkillsConfig,
    exportRemoteSkill,
    detectExternalAgentConfig,
    importExternalAgentConfig,
    readGitDiffToRemote,
    searchFuzzyFiles,
    executeCommand,
    uploadFeedback,
  };
}

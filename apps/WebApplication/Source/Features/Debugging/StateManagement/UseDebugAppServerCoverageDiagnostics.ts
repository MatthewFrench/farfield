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
  type DebugAppServerCoverageThreadRealtimeAppendTextResult,
  type DebugAppServerCoverageThreadRealtimeStartResult,
  type DebugAppServerCoverageThreadRealtimeStopResult,
  type DebugAppServerCoverageWindowsSandboxSetupMode,
  type DebugAppServerCoverageWindowsSandboxSetupStartResult,
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
  mapRateLimitSnapshot,
  mapRemoteSkills,
  mapRequirements,
  mapSkills,
  mapUserInfo,
} from "./DebugAppServerCoverageDiagnosticsMappers";
import { useDebugAppServerCoverageMutationDiagnostics } from "./UseDebugAppServerCoverageMutationDiagnostics";

const COVERAGE_WORKSPACE_SECTION: DebugWorkspaceSection = "coverage";

const COVERAGE_REQUEST_LIST_LIMIT = 100;
const COVERAGE_REQUEST_OPERATION_NAME = "debug-coverage-refresh";
const COVERAGE_ERROR_PREFIX = "Unable to load app-server coverage diagnostics: ";
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
  lastThreadRealtimeStartResult: DebugAppServerCoverageThreadRealtimeStartResult | null;
  lastThreadRealtimeAppendTextResult: DebugAppServerCoverageThreadRealtimeAppendTextResult | null;
  lastThreadRealtimeStopResult: DebugAppServerCoverageThreadRealtimeStopResult | null;
  lastWindowsSandboxSetupStartResult: DebugAppServerCoverageWindowsSandboxSetupStartResult | null;
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
  startThreadRealtime: (threadId: string, prompt: string, sessionId?: string) => void;
  appendThreadRealtimeText: (threadId: string, text: string) => void;
  stopThreadRealtime: (threadId: string) => void;
  startWindowsSandboxSetup: (mode: DebugAppServerCoverageWindowsSandboxSetupMode) => void;
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
  const [coverageDiagnosticsErrorMessage, setCoverageDiagnosticsErrorMessage] = useState("");
  const [coverageDiagnosticsSnapshot, setCoverageDiagnosticsSnapshot] =
    useState<DebugAppServerCoverageSnapshot | null>(null);
  const requestSerialRef = useRef(0);

  const refreshCoverageDiagnostics = useCallback(() => {
    runCoverageDiagnosticsRefresh({
      capabilityServerClient: input.capabilityServerClient,
      requestSerialRef,
      setIsLoadingCoverageDiagnostics,
      setCoverageDiagnosticsErrorMessage,
      setCoverageDiagnosticsSnapshot,
    });
  }, [input.capabilityServerClient]);
  const coverageMutationDiagnosticsBundle = useDebugAppServerCoverageMutationDiagnostics({
    capabilityServerClient: input.capabilityServerClient,
    refreshCoverageDiagnostics,
  });

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

  useEffect(() => {
    if (coverageDiagnosticsSnapshot === null || coverageDiagnosticsSnapshot.account === null) {
      return;
    }
    coverageMutationDiagnosticsBundle.clearPendingAccountLogin();
  }, [coverageDiagnosticsSnapshot, coverageMutationDiagnosticsBundle.clearPendingAccountLogin]);

  return {
    isLoadingCoverageDiagnostics,
    coverageDiagnosticsErrorMessage,
    coverageDiagnosticsSnapshot,
    refreshCoverageDiagnostics,
    ...coverageMutationDiagnosticsBundle.diagnostics,
  };
}

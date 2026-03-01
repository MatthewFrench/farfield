import { useCallback, useState } from "react";
import type {
  CapabilityConfigWriteMergeStrategy,
  CapabilityServerClient,
} from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import type {
  DebugAppServerCoverageAuthCompletionEventsResult,
  DebugAppServerCoverageCommandExecutionResult,
  DebugAppServerCoverageConfigBatchWriteResult,
  DebugAppServerCoverageConfigValueWriteResult,
  DebugAppServerCoverageErrorNotificationsResult,
  DebugAppServerCoverageExternalAgentConfigDetectResult,
  DebugAppServerCoverageExternalAgentConfigImportResult,
  DebugAppServerCoverageExternalAgentConfigMigrationItem,
  DebugAppServerCoverageFeedbackUploadResult,
  DebugAppServerCoverageFuzzyFileSearchResult,
  DebugAppServerCoverageFuzzyFileSearchSessionStartResult,
  DebugAppServerCoverageFuzzyFileSearchSessionStopResult,
  DebugAppServerCoverageFuzzyFileSearchSessionUpdateResult,
  DebugAppServerCoverageFuzzySessionNotificationsResult,
  DebugAppServerCoverageGitDiffToRemoteResult,
  DebugAppServerCoverageItemDeltaNotificationsResult,
  DebugAppServerCoverageItemLifecycleNotificationsResult,
  DebugAppServerCoverageModelReroutedEventsResult,
  DebugAppServerCoverageNotificationEventsResult,
  DebugAppServerCoveragePendingAccountLogin,
  DebugAppServerCoveragePendingServerRequestsResult,
  DebugAppServerCoverageServerRequestResolvedEventsResult,
  DebugAppServerCoverageThreadLifecycleNotificationsResult,
  DebugAppServerCoverageThreadRealtimeAppendAudioResult,
  DebugAppServerCoverageThreadRealtimeAppendTextResult,
  DebugAppServerCoverageThreadRealtimeAudioChunk,
  DebugAppServerCoverageThreadRealtimeStartResult,
  DebugAppServerCoverageThreadRealtimeStopResult,
  DebugAppServerCoverageThreadStreamEventsResult,
  DebugAppServerCoverageTurnLifecycleNotificationsResult,
  DebugAppServerCoverageWarningNotificationsResult,
  DebugAppServerCoverageWindowsSandboxSetupMode,
  DebugAppServerCoverageWindowsSandboxSetupStartResult,
} from "../DomainModel/DebugAppServerCoverageContracts";
import type { DebugAppServerCoverageThreadProgressNotificationsResult } from "../DomainModel/DebugAppServerCoverageThreadProgressContracts";
import {
  runConfigBatchWriteAction,
  runConfigValueWriteAction,
} from "./DebugAppServerCoverageConfigWriteActionRunners";
import { mapPendingAccountLogin } from "./DebugAppServerCoverageDiagnosticsMappers";
import {
  createReadThreadStreamEventsAction,
  runCoverageAsyncMutation,
} from "./DebugAppServerCoverageMutationActionHelpers";
import {
  runExternalAgentConfigDetectAction,
  runExternalAgentConfigImportAction,
} from "./DebugAppServerCoverageMutationActionRunners";
import { createNotificationCoverageReadActions } from "./DebugAppServerCoverageNotificationReadActionFactory";
import { useCoverageSkillMutationActions } from "./DebugAppServerCoverageSkillMutationActions";
import { useDebugAppServerCoverageRuntimeMutationActions } from "./UseDebugAppServerCoverageRuntimeMutationActions";

const COVERAGE_MUTATION_OPERATION_NAME = "debug-coverage-action";

interface UseDebugAppServerCoverageMutationDiagnosticsInput {
  capabilityServerClient: CapabilityServerClient;
  refreshCoverageDiagnostics: () => void;
}

export interface DebugAppServerCoverageMutationDiagnostics {
  isRunningCoverageAction: boolean;
  coverageActionErrorMessage: string;
  pendingAccountLogin: DebugAppServerCoveragePendingAccountLogin | null;
  lastAuthCompletionEventsResult: DebugAppServerCoverageAuthCompletionEventsResult | null;
  lastCommandExecutionResult: DebugAppServerCoverageCommandExecutionResult | null;
  lastConfigBatchWriteResult: DebugAppServerCoverageConfigBatchWriteResult | null;
  lastConfigValueWriteResult: DebugAppServerCoverageConfigValueWriteResult | null;
  lastExternalAgentConfigDetectResult: DebugAppServerCoverageExternalAgentConfigDetectResult | null;
  lastExternalAgentConfigImportResult: DebugAppServerCoverageExternalAgentConfigImportResult | null;
  lastThreadRealtimeStartResult: DebugAppServerCoverageThreadRealtimeStartResult | null;
  lastThreadRealtimeAppendAudioResult: DebugAppServerCoverageThreadRealtimeAppendAudioResult | null;
  lastThreadRealtimeAppendTextResult: DebugAppServerCoverageThreadRealtimeAppendTextResult | null;
  lastThreadRealtimeStopResult: DebugAppServerCoverageThreadRealtimeStopResult | null;
  lastThreadStreamEventsResult: DebugAppServerCoverageThreadStreamEventsResult | null;
  lastNotificationEventsResult: DebugAppServerCoverageNotificationEventsResult | null;
  lastPendingServerRequestsResult: DebugAppServerCoveragePendingServerRequestsResult | null;
  lastServerRequestResolvedEventsResult: DebugAppServerCoverageServerRequestResolvedEventsResult | null;
  lastWindowsSandboxSetupStartResult: DebugAppServerCoverageWindowsSandboxSetupStartResult | null;
  lastFeedbackUploadResult: DebugAppServerCoverageFeedbackUploadResult | null;
  lastErrorNotificationsResult: DebugAppServerCoverageErrorNotificationsResult | null;
  lastFuzzyFileSearchResult: DebugAppServerCoverageFuzzyFileSearchResult | null;
  lastFuzzyFileSearchSessionStartResult: DebugAppServerCoverageFuzzyFileSearchSessionStartResult | null;
  lastFuzzyFileSearchSessionUpdateResult: DebugAppServerCoverageFuzzyFileSearchSessionUpdateResult | null;
  lastFuzzyFileSearchSessionStopResult: DebugAppServerCoverageFuzzyFileSearchSessionStopResult | null;
  lastFuzzySessionNotificationsResult: DebugAppServerCoverageFuzzySessionNotificationsResult | null;
  lastModelReroutedEventsResult: DebugAppServerCoverageModelReroutedEventsResult | null;
  lastWarningNotificationsResult: DebugAppServerCoverageWarningNotificationsResult | null;
  lastThreadLifecycleNotificationsResult: DebugAppServerCoverageThreadLifecycleNotificationsResult | null;
  lastThreadProgressNotificationsResult: DebugAppServerCoverageThreadProgressNotificationsResult | null;
  lastTurnLifecycleNotificationsResult: DebugAppServerCoverageTurnLifecycleNotificationsResult | null;
  lastItemDeltaNotificationsResult: DebugAppServerCoverageItemDeltaNotificationsResult | null;
  lastItemLifecycleNotificationsResult: DebugAppServerCoverageItemLifecycleNotificationsResult | null;
  lastGitDiffToRemoteResult: DebugAppServerCoverageGitDiffToRemoteResult | null;
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
  appendThreadRealtimeAudio: (
    threadId: string,
    audio: DebugAppServerCoverageThreadRealtimeAudioChunk,
  ) => void;
  appendThreadRealtimeText: (threadId: string, text: string) => void;
  stopThreadRealtime: (threadId: string) => void;
  readThreadStreamEvents: (threadId: string, sinceSequence?: number | null) => void;
  readNotificationEvents: (sinceSequence?: number | null) => void;
  readAuthCompletionEvents: (sinceSequence?: number | null) => void;
  readServerRequestResolvedEvents: (sinceSequence?: number | null) => void;
  readFuzzySessionNotifications: (sinceSequence?: number | null) => void;
  readModelReroutedEvents: (sinceSequence?: number | null) => void;
  readWarningNotifications: (sinceSequence?: number | null) => void;
  readThreadLifecycleNotifications: (sinceSequence?: number | null) => void;
  readThreadProgressNotifications: (sinceSequence?: number | null) => void;
  readTurnLifecycleNotifications: (sinceSequence?: number | null) => void;
  readItemDeltaNotifications: (sinceSequence?: number | null) => void;
  readItemLifecycleNotifications: (sinceSequence?: number | null) => void;
  readErrorNotifications: (sinceSequence?: number | null) => void;
  readPendingServerRequests: () => void;
  startWindowsSandboxSetup: (mode: DebugAppServerCoverageWindowsSandboxSetupMode) => void;
  readGitDiffToRemote: (cwd: string) => void;
  searchFuzzyFiles: (query: string, roots: string[], cancellationToken?: string) => void;
  startFuzzyFileSearchSession: (sessionId: string, roots: string[]) => void;
  updateFuzzyFileSearchSession: (sessionId: string, query: string) => void;
  stopFuzzyFileSearchSession: (sessionId: string) => void;
  executeCommand: (command: string[], timeoutMs?: number, cwd?: string) => void;
  uploadFeedback: (
    classification: string,
    includeLogs: boolean,
    reason?: string,
    threadId?: string,
  ) => void;
}

export interface DebugAppServerCoverageMutationDiagnosticsBundle {
  clearPendingAccountLogin: () => void;
  diagnostics: DebugAppServerCoverageMutationDiagnostics;
}

export function useDebugAppServerCoverageMutationDiagnostics(
  input: UseDebugAppServerCoverageMutationDiagnosticsInput,
): DebugAppServerCoverageMutationDiagnosticsBundle {
  const [isRunningCoverageAction, setIsRunningCoverageAction] = useState(false);
  const [coverageActionErrorMessage, setCoverageActionErrorMessage] = useState("");
  const [pendingAccountLogin, setPendingAccountLogin] =
    useState<DebugAppServerCoveragePendingAccountLogin | null>(null);
  const [lastAuthCompletionEventsResult, setLastAuthCompletionEventsResult] =
    useState<DebugAppServerCoverageAuthCompletionEventsResult | null>(null);
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
  const [lastThreadRealtimeStartResult, setLastThreadRealtimeStartResult] =
    useState<DebugAppServerCoverageThreadRealtimeStartResult | null>(null);
  const [lastThreadRealtimeAppendAudioResult, setLastThreadRealtimeAppendAudioResult] =
    useState<DebugAppServerCoverageThreadRealtimeAppendAudioResult | null>(null);
  const [lastThreadRealtimeAppendTextResult, setLastThreadRealtimeAppendTextResult] =
    useState<DebugAppServerCoverageThreadRealtimeAppendTextResult | null>(null);
  const [lastThreadRealtimeStopResult, setLastThreadRealtimeStopResult] =
    useState<DebugAppServerCoverageThreadRealtimeStopResult | null>(null);
  const [lastThreadStreamEventsResult, setLastThreadStreamEventsResult] =
    useState<DebugAppServerCoverageThreadStreamEventsResult | null>(null);
  const [lastNotificationEventsResult, setLastNotificationEventsResult] =
    useState<DebugAppServerCoverageNotificationEventsResult | null>(null);
  const [lastPendingServerRequestsResult, setLastPendingServerRequestsResult] =
    useState<DebugAppServerCoveragePendingServerRequestsResult | null>(null);
  const [lastServerRequestResolvedEventsResult, setLastServerRequestResolvedEventsResult] =
    useState<DebugAppServerCoverageServerRequestResolvedEventsResult | null>(null);
  const [lastWindowsSandboxSetupStartResult, setLastWindowsSandboxSetupStartResult] =
    useState<DebugAppServerCoverageWindowsSandboxSetupStartResult | null>(null);
  const [lastFeedbackUploadResult, setLastFeedbackUploadResult] =
    useState<DebugAppServerCoverageFeedbackUploadResult | null>(null);
  const [lastErrorNotificationsResult, setLastErrorNotificationsResult] =
    useState<DebugAppServerCoverageErrorNotificationsResult | null>(null);
  const [lastFuzzyFileSearchResult, setLastFuzzyFileSearchResult] =
    useState<DebugAppServerCoverageFuzzyFileSearchResult | null>(null);
  const [lastFuzzyFileSearchSessionStartResult, setLastFuzzyFileSearchSessionStartResult] =
    useState<DebugAppServerCoverageFuzzyFileSearchSessionStartResult | null>(null);
  const [lastFuzzyFileSearchSessionUpdateResult, setLastFuzzyFileSearchSessionUpdateResult] =
    useState<DebugAppServerCoverageFuzzyFileSearchSessionUpdateResult | null>(null);
  const [lastFuzzyFileSearchSessionStopResult, setLastFuzzyFileSearchSessionStopResult] =
    useState<DebugAppServerCoverageFuzzyFileSearchSessionStopResult | null>(null);
  const [lastFuzzySessionNotificationsResult, setLastFuzzySessionNotificationsResult] =
    useState<DebugAppServerCoverageFuzzySessionNotificationsResult | null>(null);
  const [lastModelReroutedEventsResult, setLastModelReroutedEventsResult] =
    useState<DebugAppServerCoverageModelReroutedEventsResult | null>(null);
  const [lastWarningNotificationsResult, setLastWarningNotificationsResult] =
    useState<DebugAppServerCoverageWarningNotificationsResult | null>(null);
  const [lastThreadLifecycleNotificationsResult, setLastThreadLifecycleNotificationsResult] =
    useState<DebugAppServerCoverageThreadLifecycleNotificationsResult | null>(null);
  const [lastThreadProgressNotificationsResult, setLastThreadProgressNotificationsResult] =
    useState<DebugAppServerCoverageThreadProgressNotificationsResult | null>(null);
  const [lastTurnLifecycleNotificationsResult, setLastTurnLifecycleNotificationsResult] =
    useState<DebugAppServerCoverageTurnLifecycleNotificationsResult | null>(null);
  const [lastItemDeltaNotificationsResult, setLastItemDeltaNotificationsResult] =
    useState<DebugAppServerCoverageItemDeltaNotificationsResult | null>(null);
  const [lastItemLifecycleNotificationsResult, setLastItemLifecycleNotificationsResult] =
    useState<DebugAppServerCoverageItemLifecycleNotificationsResult | null>(null);
  const [lastGitDiffToRemoteResult, setLastGitDiffToRemoteResult] =
    useState<DebugAppServerCoverageGitDiffToRemoteResult | null>(null);

  const startAccountLogin = useCallback(() => {
    runCoverageAsyncMutation({
      isRunningCoverageAction,
      setIsRunningCoverageAction,
      setCoverageActionErrorMessage,
      run: async () => {
        const response = await input.capabilityServerClient.startAccountLogin({
          actionName: COVERAGE_MUTATION_OPERATION_NAME,
        });
        setPendingAccountLogin(mapPendingAccountLogin(response));
        input.refreshCoverageDiagnostics();
      },
    });
  }, [input.capabilityServerClient, input.refreshCoverageDiagnostics, isRunningCoverageAction]);

  const cancelAccountLogin = useCallback(() => {
    if (pendingAccountLogin === null) {
      return;
    }

    runCoverageAsyncMutation({
      isRunningCoverageAction,
      setIsRunningCoverageAction,
      setCoverageActionErrorMessage,
      run: async () => {
        await input.capabilityServerClient.cancelAccountLogin({
          loginId: pendingAccountLogin.loginId,
          actionName: COVERAGE_MUTATION_OPERATION_NAME,
        });
        setPendingAccountLogin(null);
        input.refreshCoverageDiagnostics();
      },
    });
  }, [
    input.capabilityServerClient,
    input.refreshCoverageDiagnostics,
    isRunningCoverageAction,
    pendingAccountLogin,
  ]);

  const logoutAccount = useCallback(() => {
    runCoverageAsyncMutation({
      isRunningCoverageAction,
      setIsRunningCoverageAction,
      setCoverageActionErrorMessage,
      run: async () => {
        await input.capabilityServerClient.logoutAccount({
          actionName: COVERAGE_MUTATION_OPERATION_NAME,
        });
        setPendingAccountLogin(null);
        input.refreshCoverageDiagnostics();
      },
    });
  }, [input.capabilityServerClient, input.refreshCoverageDiagnostics, isRunningCoverageAction]);

  const reloadMcpServerConfig = useCallback(() => {
    runCoverageAsyncMutation({
      isRunningCoverageAction,
      setIsRunningCoverageAction,
      setCoverageActionErrorMessage,
      run: async () => {
        await input.capabilityServerClient.reloadMcpServerConfig({
          actionName: COVERAGE_MUTATION_OPERATION_NAME,
        });
        input.refreshCoverageDiagnostics();
      },
    });
  }, [input.capabilityServerClient, input.refreshCoverageDiagnostics, isRunningCoverageAction]);

  const startMcpServerOauthLogin = useCallback(
    (serverName: string) => {
      const normalizedServerName = serverName.trim();
      if (normalizedServerName.length === 0) {
        return;
      }

      runCoverageAsyncMutation({
        isRunningCoverageAction,
        setIsRunningCoverageAction,
        setCoverageActionErrorMessage,
        run: async () => {
          const response = await input.capabilityServerClient.startMcpServerOauthLogin({
            actionName: COVERAGE_MUTATION_OPERATION_NAME,
            name: normalizedServerName,
          });
          if (typeof window.open === "function") {
            window.open(response.authorizationUrl, "_blank", "noopener,noreferrer");
          }
          input.refreshCoverageDiagnostics();
        },
      });
    },
    [input.capabilityServerClient, input.refreshCoverageDiagnostics, isRunningCoverageAction],
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

  const coverageSkillMutationActions = useCoverageSkillMutationActions({
    capabilityServerClient: input.capabilityServerClient,
    refreshCoverageDiagnostics: input.refreshCoverageDiagnostics,
    isRunningCoverageAction,
    setIsRunningCoverageAction,
    setCoverageActionErrorMessage,
  });

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

  const runtimeMutationActions = useDebugAppServerCoverageRuntimeMutationActions({
    capabilityServerClient: input.capabilityServerClient,
    isRunningCoverageAction,
    setIsRunningCoverageAction,
    setCoverageActionErrorMessage,
    setLastThreadRealtimeStartResult,
    setLastThreadRealtimeAppendAudioResult,
    setLastThreadRealtimeAppendTextResult,
    setLastThreadRealtimeStopResult,
    setLastWindowsSandboxSetupStartResult,
    setLastGitDiffToRemoteResult,
    setLastFuzzyFileSearchResult,
    setLastFuzzyFileSearchSessionStartResult,
    setLastFuzzyFileSearchSessionUpdateResult,
    setLastFuzzyFileSearchSessionStopResult,
    setLastCommandExecutionResult,
    setLastFeedbackUploadResult,
  });

  const notificationCoverageReadActions = createNotificationCoverageReadActions({
    capabilityServerClient: input.capabilityServerClient,
    isRunningCoverageAction,
    setIsRunningCoverageAction,
    setCoverageActionErrorMessage,
    setLastNotificationEventsResult,
    setLastAuthCompletionEventsResult,
    setLastServerRequestResolvedEventsResult,
    setLastFuzzySessionNotificationsResult,
    setLastModelReroutedEventsResult,
    setLastWarningNotificationsResult,
    setLastThreadLifecycleNotificationsResult,
    setLastThreadProgressNotificationsResult,
    setLastTurnLifecycleNotificationsResult,
    setLastItemDeltaNotificationsResult,
    setLastItemLifecycleNotificationsResult,
    setLastErrorNotificationsResult,
    setLastPendingServerRequestsResult,
  });

  return {
    clearPendingAccountLogin: () => {
      setPendingAccountLogin(null);
    },
    diagnostics: {
      isRunningCoverageAction,
      coverageActionErrorMessage,
      pendingAccountLogin,
      lastAuthCompletionEventsResult,
      lastCommandExecutionResult,
      lastConfigBatchWriteResult,
      lastConfigValueWriteResult,
      lastExternalAgentConfigDetectResult,
      lastExternalAgentConfigImportResult,
      lastThreadRealtimeStartResult,
      lastThreadRealtimeAppendAudioResult,
      lastThreadRealtimeAppendTextResult,
      lastThreadRealtimeStopResult,
      lastThreadStreamEventsResult,
      lastNotificationEventsResult,
      lastPendingServerRequestsResult,
      lastServerRequestResolvedEventsResult,
      lastWindowsSandboxSetupStartResult,
      lastFeedbackUploadResult,
      lastErrorNotificationsResult,
      lastFuzzyFileSearchResult,
      lastFuzzyFileSearchSessionStartResult,
      lastFuzzyFileSearchSessionUpdateResult,
      lastFuzzyFileSearchSessionStopResult,
      lastFuzzySessionNotificationsResult,
      lastModelReroutedEventsResult,
      lastWarningNotificationsResult,
      lastThreadLifecycleNotificationsResult,
      lastThreadProgressNotificationsResult,
      lastTurnLifecycleNotificationsResult,
      lastItemDeltaNotificationsResult,
      lastItemLifecycleNotificationsResult,
      lastGitDiffToRemoteResult,
      startAccountLogin,
      cancelAccountLogin,
      logoutAccount,
      reloadMcpServerConfig,
      startMcpServerOauthLogin,
      writeConfigValue,
      writeConfigBatch,
      writeSkillsConfig: coverageSkillMutationActions.writeSkillsConfig,
      exportRemoteSkill: coverageSkillMutationActions.exportRemoteSkill,
      detectExternalAgentConfig,
      importExternalAgentConfig,
      startThreadRealtime: runtimeMutationActions.startThreadRealtime,
      appendThreadRealtimeAudio: runtimeMutationActions.appendThreadRealtimeAudio,
      appendThreadRealtimeText: runtimeMutationActions.appendThreadRealtimeText,
      stopThreadRealtime: runtimeMutationActions.stopThreadRealtime,
      readThreadStreamEvents: createReadThreadStreamEventsAction({
        capabilityServerClient: input.capabilityServerClient,
        isRunningCoverageAction,
        setIsRunningCoverageAction,
        setCoverageActionErrorMessage,
        setLastThreadStreamEventsResult,
      }),
      ...notificationCoverageReadActions,
      startWindowsSandboxSetup: runtimeMutationActions.startWindowsSandboxSetup,
      readGitDiffToRemote: runtimeMutationActions.readGitDiffToRemote,
      searchFuzzyFiles: runtimeMutationActions.searchFuzzyFiles,
      startFuzzyFileSearchSession: runtimeMutationActions.startFuzzyFileSearchSession,
      updateFuzzyFileSearchSession: runtimeMutationActions.updateFuzzyFileSearchSession,
      stopFuzzyFileSearchSession: runtimeMutationActions.stopFuzzyFileSearchSession,
      executeCommand: runtimeMutationActions.executeCommand,
      uploadFeedback: runtimeMutationActions.uploadFeedback,
    },
  };
}

import { type Dispatch, type SetStateAction, useCallback } from "react";
import type { CapabilityServerClient } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import type {
  DebugAppServerCoverageCommandExecutionResult,
  DebugAppServerCoverageFeedbackUploadResult,
  DebugAppServerCoverageFuzzyFileSearchResult,
  DebugAppServerCoverageFuzzyFileSearchSessionStartResult,
  DebugAppServerCoverageFuzzyFileSearchSessionStopResult,
  DebugAppServerCoverageFuzzyFileSearchSessionUpdateResult,
  DebugAppServerCoverageGitDiffToRemoteResult,
  DebugAppServerCoverageThreadRealtimeAppendAudioResult,
  DebugAppServerCoverageThreadRealtimeAppendTextResult,
  DebugAppServerCoverageThreadRealtimeAudioChunk,
  DebugAppServerCoverageThreadRealtimeStartResult,
  DebugAppServerCoverageThreadRealtimeStopResult,
  DebugAppServerCoverageWindowsSandboxSetupMode,
  DebugAppServerCoverageWindowsSandboxSetupStartResult,
} from "../DomainModel/DebugAppServerCoverageContracts";
import {
  runCommandExecutionAction,
  runFeedbackUploadAction,
  runFuzzyFileSearchAction,
  runFuzzyFileSearchSessionStartAction,
  runFuzzyFileSearchSessionStopAction,
  runFuzzyFileSearchSessionUpdateAction,
  runGitDiffToRemoteAction,
} from "./DebugAppServerCoverageMutationActionRunners";
import {
  runThreadRealtimeAppendAudioAction,
  runThreadRealtimeAppendTextAction,
  runThreadRealtimeStartAction,
  runThreadRealtimeStopAction,
  runWindowsSandboxSetupStartAction,
} from "./DebugAppServerCoverageRealtimeMutationActionRunners";

export interface UseDebugAppServerCoverageRuntimeMutationActionsInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastThreadRealtimeStartResult: Dispatch<
    SetStateAction<DebugAppServerCoverageThreadRealtimeStartResult | null>
  >;
  setLastThreadRealtimeAppendAudioResult: Dispatch<
    SetStateAction<DebugAppServerCoverageThreadRealtimeAppendAudioResult | null>
  >;
  setLastThreadRealtimeAppendTextResult: Dispatch<
    SetStateAction<DebugAppServerCoverageThreadRealtimeAppendTextResult | null>
  >;
  setLastThreadRealtimeStopResult: Dispatch<
    SetStateAction<DebugAppServerCoverageThreadRealtimeStopResult | null>
  >;
  setLastWindowsSandboxSetupStartResult: Dispatch<
    SetStateAction<DebugAppServerCoverageWindowsSandboxSetupStartResult | null>
  >;
  setLastGitDiffToRemoteResult: Dispatch<
    SetStateAction<DebugAppServerCoverageGitDiffToRemoteResult | null>
  >;
  setLastFuzzyFileSearchResult: Dispatch<
    SetStateAction<DebugAppServerCoverageFuzzyFileSearchResult | null>
  >;
  setLastFuzzyFileSearchSessionStartResult: Dispatch<
    SetStateAction<DebugAppServerCoverageFuzzyFileSearchSessionStartResult | null>
  >;
  setLastFuzzyFileSearchSessionUpdateResult: Dispatch<
    SetStateAction<DebugAppServerCoverageFuzzyFileSearchSessionUpdateResult | null>
  >;
  setLastFuzzyFileSearchSessionStopResult: Dispatch<
    SetStateAction<DebugAppServerCoverageFuzzyFileSearchSessionStopResult | null>
  >;
  setLastCommandExecutionResult: Dispatch<
    SetStateAction<DebugAppServerCoverageCommandExecutionResult | null>
  >;
  setLastFeedbackUploadResult: Dispatch<
    SetStateAction<DebugAppServerCoverageFeedbackUploadResult | null>
  >;
}

export interface DebugAppServerCoverageRuntimeMutationActions {
  startThreadRealtime: (threadId: string, prompt: string, sessionId?: string) => void;
  appendThreadRealtimeAudio: (
    threadId: string,
    audio: DebugAppServerCoverageThreadRealtimeAudioChunk,
  ) => void;
  appendThreadRealtimeText: (threadId: string, text: string) => void;
  stopThreadRealtime: (threadId: string) => void;
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

export function useDebugAppServerCoverageRuntimeMutationActions(
  input: UseDebugAppServerCoverageRuntimeMutationActionsInput,
): DebugAppServerCoverageRuntimeMutationActions {
  const startThreadRealtime = useCallback(
    (threadId: string, prompt: string, sessionId?: string) => {
      runThreadRealtimeStartAction({
        capabilityServerClient: input.capabilityServerClient,
        isRunningCoverageAction: input.isRunningCoverageAction,
        threadId,
        prompt,
        ...(sessionId !== undefined ? { sessionId } : {}),
        setIsRunningCoverageAction: input.setIsRunningCoverageAction,
        setCoverageActionErrorMessage: input.setCoverageActionErrorMessage,
        setLastThreadRealtimeStartResult: input.setLastThreadRealtimeStartResult,
      });
    },
    [
      input.capabilityServerClient,
      input.isRunningCoverageAction,
      input.setCoverageActionErrorMessage,
      input.setIsRunningCoverageAction,
      input.setLastThreadRealtimeStartResult,
    ],
  );

  const appendThreadRealtimeAudio = useCallback(
    (threadId: string, audio: DebugAppServerCoverageThreadRealtimeAudioChunk) => {
      runThreadRealtimeAppendAudioAction({
        capabilityServerClient: input.capabilityServerClient,
        isRunningCoverageAction: input.isRunningCoverageAction,
        threadId,
        audio: {
          data: audio.data,
          sampleRate: audio.sampleRate,
          numChannels: audio.numChannels,
          ...(audio.samplesPerChannel !== null
            ? { samplesPerChannel: audio.samplesPerChannel }
            : {}),
        },
        setIsRunningCoverageAction: input.setIsRunningCoverageAction,
        setCoverageActionErrorMessage: input.setCoverageActionErrorMessage,
        setLastThreadRealtimeAppendAudioResult: input.setLastThreadRealtimeAppendAudioResult,
      });
    },
    [
      input.capabilityServerClient,
      input.isRunningCoverageAction,
      input.setCoverageActionErrorMessage,
      input.setIsRunningCoverageAction,
      input.setLastThreadRealtimeAppendAudioResult,
    ],
  );

  const appendThreadRealtimeText = useCallback(
    (threadId: string, text: string) => {
      runThreadRealtimeAppendTextAction({
        capabilityServerClient: input.capabilityServerClient,
        isRunningCoverageAction: input.isRunningCoverageAction,
        threadId,
        text,
        setIsRunningCoverageAction: input.setIsRunningCoverageAction,
        setCoverageActionErrorMessage: input.setCoverageActionErrorMessage,
        setLastThreadRealtimeAppendTextResult: input.setLastThreadRealtimeAppendTextResult,
      });
    },
    [
      input.capabilityServerClient,
      input.isRunningCoverageAction,
      input.setCoverageActionErrorMessage,
      input.setIsRunningCoverageAction,
      input.setLastThreadRealtimeAppendTextResult,
    ],
  );

  const stopThreadRealtime = useCallback(
    (threadId: string) => {
      runThreadRealtimeStopAction({
        capabilityServerClient: input.capabilityServerClient,
        isRunningCoverageAction: input.isRunningCoverageAction,
        threadId,
        setIsRunningCoverageAction: input.setIsRunningCoverageAction,
        setCoverageActionErrorMessage: input.setCoverageActionErrorMessage,
        setLastThreadRealtimeStopResult: input.setLastThreadRealtimeStopResult,
      });
    },
    [
      input.capabilityServerClient,
      input.isRunningCoverageAction,
      input.setCoverageActionErrorMessage,
      input.setIsRunningCoverageAction,
      input.setLastThreadRealtimeStopResult,
    ],
  );

  const startWindowsSandboxSetup = useCallback(
    (mode: DebugAppServerCoverageWindowsSandboxSetupMode) => {
      runWindowsSandboxSetupStartAction({
        capabilityServerClient: input.capabilityServerClient,
        isRunningCoverageAction: input.isRunningCoverageAction,
        mode,
        setIsRunningCoverageAction: input.setIsRunningCoverageAction,
        setCoverageActionErrorMessage: input.setCoverageActionErrorMessage,
        setLastWindowsSandboxSetupStartResult: input.setLastWindowsSandboxSetupStartResult,
      });
    },
    [
      input.capabilityServerClient,
      input.isRunningCoverageAction,
      input.setCoverageActionErrorMessage,
      input.setIsRunningCoverageAction,
      input.setLastWindowsSandboxSetupStartResult,
    ],
  );

  const readGitDiffToRemote = useCallback(
    (cwd: string) => {
      runGitDiffToRemoteAction({
        capabilityServerClient: input.capabilityServerClient,
        isRunningCoverageAction: input.isRunningCoverageAction,
        cwd,
        setIsRunningCoverageAction: input.setIsRunningCoverageAction,
        setCoverageActionErrorMessage: input.setCoverageActionErrorMessage,
        setLastGitDiffToRemoteResult: input.setLastGitDiffToRemoteResult,
      });
    },
    [
      input.capabilityServerClient,
      input.isRunningCoverageAction,
      input.setCoverageActionErrorMessage,
      input.setIsRunningCoverageAction,
      input.setLastGitDiffToRemoteResult,
    ],
  );

  const searchFuzzyFiles = useCallback(
    (query: string, roots: string[], cancellationToken?: string) => {
      runFuzzyFileSearchAction({
        capabilityServerClient: input.capabilityServerClient,
        isRunningCoverageAction: input.isRunningCoverageAction,
        query,
        roots,
        ...(cancellationToken !== undefined ? { cancellationToken } : {}),
        setIsRunningCoverageAction: input.setIsRunningCoverageAction,
        setCoverageActionErrorMessage: input.setCoverageActionErrorMessage,
        setLastFuzzyFileSearchResult: input.setLastFuzzyFileSearchResult,
      });
    },
    [
      input.capabilityServerClient,
      input.isRunningCoverageAction,
      input.setCoverageActionErrorMessage,
      input.setIsRunningCoverageAction,
      input.setLastFuzzyFileSearchResult,
    ],
  );

  const startFuzzyFileSearchSession = useCallback(
    (sessionId: string, roots: string[]) => {
      runFuzzyFileSearchSessionStartAction({
        capabilityServerClient: input.capabilityServerClient,
        isRunningCoverageAction: input.isRunningCoverageAction,
        sessionId,
        roots,
        setIsRunningCoverageAction: input.setIsRunningCoverageAction,
        setCoverageActionErrorMessage: input.setCoverageActionErrorMessage,
        setLastFuzzyFileSearchSessionStartResult: input.setLastFuzzyFileSearchSessionStartResult,
      });
    },
    [
      input.capabilityServerClient,
      input.isRunningCoverageAction,
      input.setCoverageActionErrorMessage,
      input.setIsRunningCoverageAction,
      input.setLastFuzzyFileSearchSessionStartResult,
    ],
  );

  const updateFuzzyFileSearchSession = useCallback(
    (sessionId: string, query: string) => {
      runFuzzyFileSearchSessionUpdateAction({
        capabilityServerClient: input.capabilityServerClient,
        isRunningCoverageAction: input.isRunningCoverageAction,
        sessionId,
        query,
        setIsRunningCoverageAction: input.setIsRunningCoverageAction,
        setCoverageActionErrorMessage: input.setCoverageActionErrorMessage,
        setLastFuzzyFileSearchSessionUpdateResult: input.setLastFuzzyFileSearchSessionUpdateResult,
      });
    },
    [
      input.capabilityServerClient,
      input.isRunningCoverageAction,
      input.setCoverageActionErrorMessage,
      input.setIsRunningCoverageAction,
      input.setLastFuzzyFileSearchSessionUpdateResult,
    ],
  );

  const stopFuzzyFileSearchSession = useCallback(
    (sessionId: string) => {
      runFuzzyFileSearchSessionStopAction({
        capabilityServerClient: input.capabilityServerClient,
        isRunningCoverageAction: input.isRunningCoverageAction,
        sessionId,
        setIsRunningCoverageAction: input.setIsRunningCoverageAction,
        setCoverageActionErrorMessage: input.setCoverageActionErrorMessage,
        setLastFuzzyFileSearchSessionStopResult: input.setLastFuzzyFileSearchSessionStopResult,
      });
    },
    [
      input.capabilityServerClient,
      input.isRunningCoverageAction,
      input.setCoverageActionErrorMessage,
      input.setIsRunningCoverageAction,
      input.setLastFuzzyFileSearchSessionStopResult,
    ],
  );

  const executeCommand = useCallback(
    (command: string[], timeoutMs?: number, cwd?: string) => {
      runCommandExecutionAction({
        capabilityServerClient: input.capabilityServerClient,
        isRunningCoverageAction: input.isRunningCoverageAction,
        command,
        ...(timeoutMs !== undefined ? { timeoutMs } : {}),
        ...(cwd !== undefined ? { cwd } : {}),
        setIsRunningCoverageAction: input.setIsRunningCoverageAction,
        setCoverageActionErrorMessage: input.setCoverageActionErrorMessage,
        setLastCommandExecutionResult: input.setLastCommandExecutionResult,
      });
    },
    [
      input.capabilityServerClient,
      input.isRunningCoverageAction,
      input.setCoverageActionErrorMessage,
      input.setIsRunningCoverageAction,
      input.setLastCommandExecutionResult,
    ],
  );

  const uploadFeedback = useCallback(
    (classification: string, includeLogs: boolean, reason?: string, threadId?: string) => {
      runFeedbackUploadAction({
        capabilityServerClient: input.capabilityServerClient,
        isRunningCoverageAction: input.isRunningCoverageAction,
        classification,
        includeLogs,
        ...(reason !== undefined ? { reason } : {}),
        ...(threadId !== undefined ? { threadId } : {}),
        setIsRunningCoverageAction: input.setIsRunningCoverageAction,
        setCoverageActionErrorMessage: input.setCoverageActionErrorMessage,
        setLastFeedbackUploadResult: input.setLastFeedbackUploadResult,
      });
    },
    [
      input.capabilityServerClient,
      input.isRunningCoverageAction,
      input.setCoverageActionErrorMessage,
      input.setIsRunningCoverageAction,
      input.setLastFeedbackUploadResult,
    ],
  );

  return {
    startThreadRealtime,
    appendThreadRealtimeAudio,
    appendThreadRealtimeText,
    stopThreadRealtime,
    startWindowsSandboxSetup,
    readGitDiffToRemote,
    searchFuzzyFiles,
    startFuzzyFileSearchSession,
    updateFuzzyFileSearchSession,
    stopFuzzyFileSearchSession,
    executeCommand,
    uploadFeedback,
  };
}

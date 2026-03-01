import { type Dispatch, type SetStateAction, useCallback } from "react";
import type { CapabilityServerClient } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import type {
  DebugAppServerCoverageCommandExecutionResult,
  DebugAppServerCoverageFeedbackUploadResult,
  DebugAppServerCoverageFuzzyFileSearchResult,
  DebugAppServerCoverageGitDiffToRemoteResult,
  DebugAppServerCoverageThreadRealtimeAppendTextResult,
  DebugAppServerCoverageThreadRealtimeStartResult,
  DebugAppServerCoverageThreadRealtimeStopResult,
  DebugAppServerCoverageWindowsSandboxSetupMode,
  DebugAppServerCoverageWindowsSandboxSetupStartResult,
} from "../DomainModel/DebugAppServerCoverageContracts";
import {
  runCommandExecutionAction,
  runFeedbackUploadAction,
  runFuzzyFileSearchAction,
  runGitDiffToRemoteAction,
  runThreadRealtimeAppendTextAction,
  runThreadRealtimeStartAction,
  runThreadRealtimeStopAction,
  runWindowsSandboxSetupStartAction,
} from "./DebugAppServerCoverageMutationActionRunners";

export interface UseDebugAppServerCoverageRuntimeMutationActionsInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastThreadRealtimeStartResult: Dispatch<
    SetStateAction<DebugAppServerCoverageThreadRealtimeStartResult | null>
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
  setLastCommandExecutionResult: Dispatch<
    SetStateAction<DebugAppServerCoverageCommandExecutionResult | null>
  >;
  setLastFeedbackUploadResult: Dispatch<
    SetStateAction<DebugAppServerCoverageFeedbackUploadResult | null>
  >;
}

export interface DebugAppServerCoverageRuntimeMutationActions {
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
    appendThreadRealtimeText,
    stopThreadRealtime,
    startWindowsSandboxSetup,
    readGitDiffToRemote,
    searchFuzzyFiles,
    executeCommand,
    uploadFeedback,
  };
}

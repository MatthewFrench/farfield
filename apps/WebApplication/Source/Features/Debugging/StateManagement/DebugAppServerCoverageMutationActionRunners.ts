import { type Dispatch, type SetStateAction } from "react";
import type { CapabilityServerClient } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import type {
  DebugAppServerCoverageCommandExecutionResult,
  DebugAppServerCoverageExternalAgentConfigDetectResult,
  DebugAppServerCoverageExternalAgentConfigImportResult,
  DebugAppServerCoverageExternalAgentConfigMigrationItem,
  DebugAppServerCoverageFeedbackUploadResult,
  DebugAppServerCoverageFuzzyFileSearchResult,
  DebugAppServerCoverageGitDiffToRemoteResult,
} from "../DomainModel/DebugAppServerCoverageContracts";
import {
  mapCommandExecutionResult,
  mapExternalAgentConfigDetectResult,
  mapExternalAgentConfigImportResult,
  mapFeedbackUploadResult,
  mapFuzzyFileSearchResult,
  mapGitDiffToRemoteResult,
} from "./DebugAppServerCoverageDiagnosticsMappers";

const COVERAGE_MUTATION_OPERATION_NAME = "debug-coverage-action";
const COVERAGE_ACTION_ERROR_PREFIX = "Unable to run coverage action: ";

function toErrorMessage<ErrorType>(error: ErrorType): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}

export interface RunCommandExecutionActionInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  command: string[];
  timeoutMs?: number;
  cwd?: string;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastCommandExecutionResult: Dispatch<
    SetStateAction<DebugAppServerCoverageCommandExecutionResult | null>
  >;
}

export function runCommandExecutionAction(input: RunCommandExecutionActionInput): void {
  if (input.isRunningCoverageAction) {
    return;
  }
  if (input.command.length === 0) {
    return;
  }

  const normalizedCommand = input.command.map((entry) => entry.trim());
  if (normalizedCommand.some((entry) => entry.length === 0)) {
    return;
  }
  const normalizedWorkingDirectory = input.cwd?.trim();
  if (
    input.cwd !== undefined &&
    normalizedWorkingDirectory !== undefined &&
    normalizedWorkingDirectory.length === 0
  ) {
    return;
  }

  input.setIsRunningCoverageAction(true);
  input.setCoverageActionErrorMessage("");

  void (async () => {
    try {
      const response = await input.capabilityServerClient.executeCommand({
        actionName: COVERAGE_MUTATION_OPERATION_NAME,
        command: normalizedCommand,
        ...(input.timeoutMs !== undefined ? { timeoutMs: input.timeoutMs } : {}),
        ...(normalizedWorkingDirectory !== undefined ? { cwd: normalizedWorkingDirectory } : {}),
      });
      input.setLastCommandExecutionResult(mapCommandExecutionResult(response, normalizedCommand));
    } catch (error) {
      input.setCoverageActionErrorMessage(
        `${COVERAGE_ACTION_ERROR_PREFIX}${toErrorMessage(error)}`,
      );
    } finally {
      input.setIsRunningCoverageAction(false);
    }
  })();
}

export interface RunFeedbackUploadActionInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  classification: string;
  includeLogs: boolean;
  reason?: string;
  threadId?: string;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastFeedbackUploadResult: Dispatch<
    SetStateAction<DebugAppServerCoverageFeedbackUploadResult | null>
  >;
}

export function runFeedbackUploadAction(input: RunFeedbackUploadActionInput): void {
  if (input.isRunningCoverageAction) {
    return;
  }

  const normalizedClassification = input.classification.trim();
  if (normalizedClassification.length === 0) {
    return;
  }

  const normalizedReason = input.reason?.trim();
  if (
    input.reason !== undefined &&
    normalizedReason !== undefined &&
    normalizedReason.length === 0
  ) {
    return;
  }

  const normalizedThreadId = input.threadId?.trim();
  if (
    input.threadId !== undefined &&
    normalizedThreadId !== undefined &&
    normalizedThreadId.length === 0
  ) {
    return;
  }

  input.setIsRunningCoverageAction(true);
  input.setCoverageActionErrorMessage("");

  void (async () => {
    try {
      const response = await input.capabilityServerClient.uploadFeedback({
        actionName: COVERAGE_MUTATION_OPERATION_NAME,
        classification: normalizedClassification,
        includeLogs: input.includeLogs,
        ...(normalizedReason !== undefined ? { reason: normalizedReason } : {}),
        ...(normalizedThreadId !== undefined ? { threadId: normalizedThreadId } : {}),
      });
      input.setLastFeedbackUploadResult(
        mapFeedbackUploadResult(
          response,
          normalizedClassification,
          input.includeLogs,
          normalizedReason ?? null,
          normalizedThreadId ?? null,
        ),
      );
    } catch (error) {
      input.setCoverageActionErrorMessage(
        `${COVERAGE_ACTION_ERROR_PREFIX}${toErrorMessage(error)}`,
      );
    } finally {
      input.setIsRunningCoverageAction(false);
    }
  })();
}

export interface RunGitDiffToRemoteActionInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  cwd: string;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastGitDiffToRemoteResult: Dispatch<
    SetStateAction<DebugAppServerCoverageGitDiffToRemoteResult | null>
  >;
}

export function runGitDiffToRemoteAction(input: RunGitDiffToRemoteActionInput): void {
  if (input.isRunningCoverageAction) {
    return;
  }

  const normalizedWorkingDirectory = input.cwd.trim();
  if (normalizedWorkingDirectory.length === 0) {
    return;
  }

  input.setIsRunningCoverageAction(true);
  input.setCoverageActionErrorMessage("");

  void (async () => {
    try {
      const response = await input.capabilityServerClient.readGitDiffToRemote({
        actionName: COVERAGE_MUTATION_OPERATION_NAME,
        cwd: normalizedWorkingDirectory,
      });
      input.setLastGitDiffToRemoteResult(
        mapGitDiffToRemoteResult(response, normalizedWorkingDirectory),
      );
    } catch (error) {
      input.setCoverageActionErrorMessage(
        `${COVERAGE_ACTION_ERROR_PREFIX}${toErrorMessage(error)}`,
      );
    } finally {
      input.setIsRunningCoverageAction(false);
    }
  })();
}

export interface RunFuzzyFileSearchActionInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  query: string;
  roots: string[];
  cancellationToken?: string;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastFuzzyFileSearchResult: Dispatch<
    SetStateAction<DebugAppServerCoverageFuzzyFileSearchResult | null>
  >;
}

export function runFuzzyFileSearchAction(input: RunFuzzyFileSearchActionInput): void {
  if (input.isRunningCoverageAction) {
    return;
  }

  const normalizedQuery = input.query.trim();
  if (normalizedQuery.length === 0) {
    return;
  }

  const normalizedRoots = input.roots.map((rootPath) => rootPath.trim());
  if (normalizedRoots.length === 0 || normalizedRoots.some((rootPath) => rootPath.length === 0)) {
    return;
  }

  const normalizedCancellationToken = input.cancellationToken?.trim();
  if (
    input.cancellationToken !== undefined &&
    normalizedCancellationToken !== undefined &&
    normalizedCancellationToken.length === 0
  ) {
    return;
  }

  input.setIsRunningCoverageAction(true);
  input.setCoverageActionErrorMessage("");

  void (async () => {
    try {
      const response = await input.capabilityServerClient.searchFuzzyFiles({
        actionName: COVERAGE_MUTATION_OPERATION_NAME,
        query: normalizedQuery,
        roots: normalizedRoots,
        ...(normalizedCancellationToken !== undefined
          ? { cancellationToken: normalizedCancellationToken }
          : {}),
      });
      input.setLastFuzzyFileSearchResult(
        mapFuzzyFileSearchResult(response, normalizedQuery, normalizedRoots),
      );
    } catch (error) {
      input.setCoverageActionErrorMessage(
        `${COVERAGE_ACTION_ERROR_PREFIX}${toErrorMessage(error)}`,
      );
    } finally {
      input.setIsRunningCoverageAction(false);
    }
  })();
}

export interface RunExternalAgentConfigDetectActionInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  includeHome: boolean;
  cwds: string[];
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastExternalAgentConfigDetectResult: Dispatch<
    SetStateAction<DebugAppServerCoverageExternalAgentConfigDetectResult | null>
  >;
}

export function runExternalAgentConfigDetectAction(
  input: RunExternalAgentConfigDetectActionInput,
): void {
  if (input.isRunningCoverageAction) {
    return;
  }

  const normalizedWorkingDirectories = input.cwds.map((cwd) => cwd.trim());
  if (
    normalizedWorkingDirectories.some((workingDirectory) => workingDirectory.length === 0) ||
    (!input.includeHome && normalizedWorkingDirectories.length === 0)
  ) {
    return;
  }

  input.setIsRunningCoverageAction(true);
  input.setCoverageActionErrorMessage("");

  void (async () => {
    try {
      const response = await input.capabilityServerClient.detectExternalAgentConfig({
        actionName: COVERAGE_MUTATION_OPERATION_NAME,
        includeHome: input.includeHome,
        ...(normalizedWorkingDirectories.length > 0 ? { cwds: normalizedWorkingDirectories } : {}),
      });
      input.setLastExternalAgentConfigDetectResult(
        mapExternalAgentConfigDetectResult(
          response,
          input.includeHome,
          normalizedWorkingDirectories,
        ),
      );
    } catch (error) {
      input.setCoverageActionErrorMessage(
        `${COVERAGE_ACTION_ERROR_PREFIX}${toErrorMessage(error)}`,
      );
    } finally {
      input.setIsRunningCoverageAction(false);
    }
  })();
}

export interface RunExternalAgentConfigImportActionInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  migrationItems: DebugAppServerCoverageExternalAgentConfigMigrationItem[];
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastExternalAgentConfigImportResult: Dispatch<
    SetStateAction<DebugAppServerCoverageExternalAgentConfigImportResult | null>
  >;
}

export function runExternalAgentConfigImportAction(
  input: RunExternalAgentConfigImportActionInput,
): void {
  if (input.isRunningCoverageAction || input.migrationItems.length === 0) {
    return;
  }

  input.setIsRunningCoverageAction(true);
  input.setCoverageActionErrorMessage("");

  void (async () => {
    try {
      await input.capabilityServerClient.importExternalAgentConfig({
        actionName: COVERAGE_MUTATION_OPERATION_NAME,
        migrationItems: input.migrationItems.map((migrationItem) => ({
          itemType: migrationItem.itemType,
          description: migrationItem.description,
          cwd: migrationItem.cwd,
        })),
      });
      input.setLastExternalAgentConfigImportResult(
        mapExternalAgentConfigImportResult(input.migrationItems.length),
      );
    } catch (error) {
      input.setCoverageActionErrorMessage(
        `${COVERAGE_ACTION_ERROR_PREFIX}${toErrorMessage(error)}`,
      );
    } finally {
      input.setIsRunningCoverageAction(false);
    }
  })();
}

import { type Dispatch, type SetStateAction, useCallback } from "react";
import type { CapabilityServerClient } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import { runCoverageAsyncMutation } from "./DebugAppServerCoverageMutationActionHelpers";

const COVERAGE_MUTATION_OPERATION_NAME = "debug-coverage-action";

interface RunWriteSkillsConfigMutationInput {
  capabilityServerClient: CapabilityServerClient;
  refreshCoverageDiagnostics: () => void;
  isRunningCoverageAction: boolean;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  skillPath: string;
  enabled: boolean;
}

interface RunExportRemoteSkillMutationInput {
  capabilityServerClient: CapabilityServerClient;
  refreshCoverageDiagnostics: () => void;
  isRunningCoverageAction: boolean;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  hazelnutId: string;
}

interface UseCoverageSkillMutationActionsInput {
  capabilityServerClient: CapabilityServerClient;
  refreshCoverageDiagnostics: () => void;
  isRunningCoverageAction: boolean;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
}

interface CoverageSkillMutationActions {
  writeSkillsConfig: (skillPath: string, enabled: boolean) => void;
  exportRemoteSkill: (hazelnutId: string) => void;
}

function runWriteSkillsConfigMutation(input: RunWriteSkillsConfigMutationInput): void {
  const normalizedSkillPath = input.skillPath.trim();
  if (normalizedSkillPath.length === 0) {
    return;
  }

  runCoverageAsyncMutation({
    isRunningCoverageAction: input.isRunningCoverageAction,
    setIsRunningCoverageAction: input.setIsRunningCoverageAction,
    setCoverageActionErrorMessage: input.setCoverageActionErrorMessage,
    run: async () => {
      await input.capabilityServerClient.writeSkillsConfig({
        actionName: COVERAGE_MUTATION_OPERATION_NAME,
        path: normalizedSkillPath,
        enabled: input.enabled,
      });
      input.refreshCoverageDiagnostics();
    },
  });
}

function runExportRemoteSkillMutation(input: RunExportRemoteSkillMutationInput): void {
  const normalizedHazelnutIdentifier = input.hazelnutId.trim();
  if (normalizedHazelnutIdentifier.length === 0) {
    return;
  }

  runCoverageAsyncMutation({
    isRunningCoverageAction: input.isRunningCoverageAction,
    setIsRunningCoverageAction: input.setIsRunningCoverageAction,
    setCoverageActionErrorMessage: input.setCoverageActionErrorMessage,
    run: async () => {
      await input.capabilityServerClient.exportRemoteSkill({
        actionName: COVERAGE_MUTATION_OPERATION_NAME,
        hazelnutId: normalizedHazelnutIdentifier,
      });
      input.refreshCoverageDiagnostics();
    },
  });
}

export function useCoverageSkillMutationActions(
  input: UseCoverageSkillMutationActionsInput,
): CoverageSkillMutationActions {
  const writeSkillsConfig = useCallback(
    (skillPath: string, enabled: boolean) => {
      runWriteSkillsConfigMutation({
        capabilityServerClient: input.capabilityServerClient,
        refreshCoverageDiagnostics: input.refreshCoverageDiagnostics,
        isRunningCoverageAction: input.isRunningCoverageAction,
        setIsRunningCoverageAction: input.setIsRunningCoverageAction,
        setCoverageActionErrorMessage: input.setCoverageActionErrorMessage,
        skillPath,
        enabled,
      });
    },
    [
      input.capabilityServerClient,
      input.refreshCoverageDiagnostics,
      input.isRunningCoverageAction,
      input.setIsRunningCoverageAction,
      input.setCoverageActionErrorMessage,
    ],
  );

  const exportRemoteSkill = useCallback(
    (hazelnutId: string) => {
      runExportRemoteSkillMutation({
        capabilityServerClient: input.capabilityServerClient,
        refreshCoverageDiagnostics: input.refreshCoverageDiagnostics,
        isRunningCoverageAction: input.isRunningCoverageAction,
        setIsRunningCoverageAction: input.setIsRunningCoverageAction,
        setCoverageActionErrorMessage: input.setCoverageActionErrorMessage,
        hazelnutId,
      });
    },
    [
      input.capabilityServerClient,
      input.refreshCoverageDiagnostics,
      input.isRunningCoverageAction,
      input.setIsRunningCoverageAction,
      input.setCoverageActionErrorMessage,
    ],
  );

  return {
    writeSkillsConfig,
    exportRemoteSkill,
  };
}

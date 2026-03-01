import type {
  CommandExecutionOptions,
  ConfigBatchWriteOptions,
  ConfigWriteValueOptions,
  FeedbackUploadOptions,
  StartMcpServerOauthLoginOptions,
  WriteSkillsConfigOptions,
} from "@farfield/api";
import type {
  AgentCommandExecutionInput,
  AgentStartMcpServerOauthLoginInput,
  AgentUploadFeedbackInput,
  AgentWriteConfigBatchInput,
  AgentWriteConfigValueInput,
  AgentWriteSkillsConfigInput,
} from "../Types.js";

/**
 * Owns app-server mutation-option mapping for Codex thread-management capability routes.
 */
export function buildStartMcpServerOauthLoginOptions(
  input: AgentStartMcpServerOauthLoginInput,
): StartMcpServerOauthLoginOptions {
  return {
    name: input.name,
    ...(input.scopes !== undefined ? { scopes: input.scopes } : {}),
    ...(input.timeoutSeconds !== undefined ? { timeoutSeconds: input.timeoutSeconds } : {}),
  };
}

export function buildWriteConfigValueOptions(
  input: AgentWriteConfigValueInput,
): ConfigWriteValueOptions {
  return {
    keyPath: input.keyPath,
    value: input.value,
    mergeStrategy: input.mergeStrategy,
    ...(input.filePath !== undefined ? { filePath: input.filePath } : {}),
    ...(input.expectedVersion !== undefined ? { expectedVersion: input.expectedVersion } : {}),
  };
}

export function buildWriteConfigBatchOptions(
  input: AgentWriteConfigBatchInput,
): ConfigBatchWriteOptions {
  return {
    edits: input.edits.map((edit) => ({
      keyPath: edit.keyPath,
      value: edit.value,
      mergeStrategy: edit.mergeStrategy,
    })),
    ...(input.filePath !== undefined ? { filePath: input.filePath } : {}),
    ...(input.expectedVersion !== undefined ? { expectedVersion: input.expectedVersion } : {}),
  };
}

export function buildWriteSkillsConfigOptions(
  input: AgentWriteSkillsConfigInput,
): WriteSkillsConfigOptions {
  return {
    path: input.path,
    enabled: input.enabled,
  };
}

export function buildCommandExecutionOptions(
  input: AgentCommandExecutionInput,
): CommandExecutionOptions {
  return {
    command: input.command,
    ...(input.timeoutMilliseconds !== undefined
      ? { timeoutMilliseconds: input.timeoutMilliseconds }
      : {}),
    ...(input.cwd !== undefined ? { cwd: input.cwd } : {}),
  };
}

export function buildFeedbackUploadOptions(input: AgentUploadFeedbackInput): FeedbackUploadOptions {
  return {
    classification: input.classification,
    includeLogs: input.includeLogs,
    ...(input.reason !== undefined ? { reason: input.reason } : {}),
    ...(input.threadId !== undefined ? { threadId: input.threadId } : {}),
  };
}

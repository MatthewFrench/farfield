import type {
  CommandExecutionOptions,
  ConfigBatchWriteOptions,
  ConfigWriteValueOptions,
  ExternalAgentConfigDetectOptions,
  ExternalAgentConfigImportOptions,
  FeedbackUploadOptions,
  StartMcpServerOauthLoginOptions,
  ThreadRealtimeAppendTextOptions,
  ThreadRealtimeStartOptions,
  ThreadRealtimeStopOptions,
  WindowsSandboxSetupStartOptions,
  WriteSkillsConfigOptions,
} from "@farfield/api";
import type {
  AgentAppendThreadRealtimeTextInput,
  AgentCommandExecutionInput,
  AgentDetectExternalAgentConfigInput,
  AgentImportExternalAgentConfigInput,
  AgentStartMcpServerOauthLoginInput,
  AgentStartThreadRealtimeInput,
  AgentStartWindowsSandboxSetupInput,
  AgentStopThreadRealtimeInput,
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

export function buildExternalAgentConfigDetectOptions(
  input: AgentDetectExternalAgentConfigInput,
): ExternalAgentConfigDetectOptions {
  return {
    includeHome: input.includeHome,
    ...(input.cwds !== undefined ? { cwds: input.cwds } : {}),
  };
}

export function buildExternalAgentConfigImportOptions(
  input: AgentImportExternalAgentConfigInput,
): ExternalAgentConfigImportOptions {
  return {
    migrationItems: input.migrationItems.map((migrationItem) => ({
      itemType: migrationItem.itemType,
      description: migrationItem.description,
      cwd: migrationItem.cwd,
    })),
  };
}

export function buildThreadRealtimeStartOptions(
  input: AgentStartThreadRealtimeInput,
): ThreadRealtimeStartOptions {
  return {
    threadId: input.threadId,
    prompt: input.prompt,
    ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
  };
}

export function buildThreadRealtimeAppendTextOptions(
  input: AgentAppendThreadRealtimeTextInput,
): ThreadRealtimeAppendTextOptions {
  return {
    threadId: input.threadId,
    text: input.text,
  };
}

export function buildThreadRealtimeStopOptions(
  input: AgentStopThreadRealtimeInput,
): ThreadRealtimeStopOptions {
  return {
    threadId: input.threadId,
  };
}

export function buildWindowsSandboxSetupStartOptions(
  input: AgentStartWindowsSandboxSetupInput,
): WindowsSandboxSetupStartOptions {
  return {
    mode: input.mode,
  };
}

import { AppServerRpcError } from "@farfield/api";
import type { IpcFrame } from "@farfield/protocol";
import type { AgentCapabilities } from "../Types.js";

export const CODEX_AGENT_IDENTIFIER = "codex";
export const CODEX_AGENT_LABEL = "Codex";
export const APP_SERVER_INVALID_REQUEST_ERROR_CODE = -32600;
export const APP_SERVER_INVALID_REQUEST_MESSAGE_FRAGMENT = {
  threadNotLoaded: "thread not loaded",
  conversationNotFound: "conversation not found",
} as const;

export interface CodexAgentRuntimeState {
  appReady: boolean;
  ipcConnected: boolean;
  ipcInitialized: boolean;
  codexAvailable: boolean;
  lastError: string | null;
}

export interface CodexIpcFrameEvent {
  direction: "in" | "out";
  frame: IpcFrame;
  method: string;
  threadId: string | null;
}

export const INBOUND_IPC_FRAME_DIRECTION: CodexIpcFrameEvent["direction"] = "in";

export const CODEX_AGENT_CAPABILITIES: AgentCapabilities = {
  canListModels: true,
  canListCollaborationModes: true,
  canReadConfigRequirements: true,
  canListExperimentalFeatures: true,
  canListMcpServerStatuses: true,
  canListApps: true,
  canListSkills: true,
  canSetCollaborationMode: true,
  canSubmitUserInput: true,
  canReadLiveState: true,
  canReadStreamEvents: true,
};

export function isInvalidRequestErrorMatchingMessageFragment<ErrorType>(
  error: ErrorType,
  messageFragment: string,
): boolean {
  if (!(error instanceof AppServerRpcError)) {
    return false;
  }

  if (error.code !== APP_SERVER_INVALID_REQUEST_ERROR_CODE) {
    return false;
  }

  return error.message.includes(messageFragment);
}

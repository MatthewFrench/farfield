import type {
  EventMessagePartUpdated,
  EventMessageUpdated,
  EventPermissionUpdated,
  EventSessionStatus,
  EventSessionUpdated,
} from "@opencode-ai/sdk";
import type { OpenCodeStructuredDataValue } from "./Schemas.js";

export type MappedToolLifecycleStatus = "running" | "completed" | "error";
export type MappedTurnStatus = "pending" | MappedToolLifecycleStatus;
export type MappedFileChangeKindType = "created" | "modified";

/**
 * Mapped thread list item, matching the shape of AppServerThreadListItemSchema.
 */
export interface MappedThreadListItem {
  id: string;
  preview: string;
  createdAt: number;
  updatedAt: number;
  cwd?: string;
  source: "opencode";
}

export interface MappedUserMessageTurnItem {
  id: string;
  type: "userMessage";
  content: Array<{ type: "text"; text: string }>;
}

export interface MappedAgentMessageTurnItem {
  id: string;
  type: "agentMessage";
  text: string;
}

export interface MappedReasoningTurnItem {
  id: string;
  type: "reasoning";
  text: string;
  summary?: string[];
}

export interface MappedCommandExecutionTurnItem {
  id: string;
  type: "commandExecution";
  command: string;
  status: MappedToolLifecycleStatus;
  cwd?: string;
  aggregatedOutput?: string | null;
  exitCode?: number | null;
  durationMs?: number | null;
}

export interface MappedFileChangeEntry {
  path: string;
  kind: { type: MappedFileChangeKindType };
  diff?: string;
}

export interface MappedFileChangeTurnItem {
  id: string;
  type: "fileChange";
  changes: MappedFileChangeEntry[];
  status: MappedToolLifecycleStatus;
}

/**
 * Mapped turn item, matching the shape of TurnItemSchema discriminated union.
 */
export type MappedTurnItem =
  | MappedUserMessageTurnItem
  | MappedAgentMessageTurnItem
  | MappedReasoningTurnItem
  | MappedCommandExecutionTurnItem
  | MappedFileChangeTurnItem;

/**
 * Mapped turn, matching the shape of ThreadTurnSchema.
 */
export interface MappedTurn {
  turnId: string | null;
  id: string;
  status: MappedTurnStatus;
  turnStartedAtMs: number | null;
  finalAssistantStartedAtMs: number | null;
  error: OpenCodeStructuredDataValue | null;
  diff: OpenCodeStructuredDataValue | null;
  items: MappedTurnItem[];
}

/**
 * Mapped thread conversation state, matching ThreadConversationStateSchema.
 */
export interface MappedThreadConversationState {
  id: string;
  turns: MappedTurn[];
  requests: never[];
  createdAt: number;
  updatedAt: number;
  title: string | null;
  latestModel: string | null;
  cwd?: string;
  source: "opencode";
}

export type OpenCodeEvent =
  | EventMessageUpdated
  | EventMessagePartUpdated
  | EventSessionUpdated
  | EventSessionStatus
  | EventPermissionUpdated;

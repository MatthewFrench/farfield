import type {
  EventMessagePartUpdated,
  EventMessageUpdated,
  EventPermissionUpdated,
  EventSessionStatus,
  EventSessionUpdated
} from "@opencode-ai/sdk";
import type { OpenCodeStructuredDataValue } from "./Schemas.js";

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

/**
 * Mapped turn item, matching the shape of TurnItemSchema discriminated union.
 */
export type MappedTurnItem =
  | { id: string; type: "userMessage"; content: Array<{ type: "text"; text: string }> }
  | { id: string; type: "agentMessage"; text: string }
  | { id: string; type: "reasoning"; text: string; summary?: string[] }
  | {
      id: string;
      type: "commandExecution";
      command: string;
      status: string;
      cwd?: string;
      aggregatedOutput?: string | null;
      exitCode?: number | null;
      durationMs?: number | null;
    }
  | {
      id: string;
      type: "fileChange";
      changes: Array<{ path: string; kind: { type: string }; diff?: string }>;
      status: string;
    };

/**
 * Mapped turn, matching the shape of ThreadTurnSchema.
 */
export interface MappedTurn {
  turnId: string | null;
  id: string;
  status: string;
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

import type { MappedTurn, MappedTurnItem, MappedTurnStatus } from "./MapperContracts.js";
import type { OpenCodeMessage, OpenCodePart } from "./Schemas.js";
import { isTextPart, partToTurnItem } from "./TurnItemMapper.js";

const COMPLETED_ASSISTANT_FINISH_REASONS = new Set<string>(["stop", "length"]);

/**
 * Reconstruct turns from OpenCode messages.
 *
 * OpenCode has no first-class "turn" concept. A turn is a user message
 * paired with the assistant message that responds to it (linked via parentID).
 */
export function messagesToTurns(
  messages: OpenCodeMessage[],
  partsByMessage: Map<string, OpenCodePart[]>,
): MappedTurn[] {
  const turns: MappedTurn[] = [];
  const assistantByParent = new Map<string, OpenCodeMessage>();

  for (const msg of messages) {
    if (msg.role === "assistant") {
      const existing = assistantByParent.get(msg.parentID);
      if (existing === undefined || shouldPreferAssistantMessage(msg, existing)) {
        assistantByParent.set(msg.parentID, msg);
      }
    }
  }

  for (const msg of messages) {
    if (msg.role !== "user") {
      continue;
    }

    const userMsg = msg;
    const assistantMsg = assistantByParent.get(userMsg.id) ?? null;
    const items: MappedTurnItem[] = [];

    const userParts = partsByMessage.get(userMsg.id) ?? [];
    const userTextParts = userParts.filter(isTextPart);

    if (userTextParts.length > 0) {
      items.push({
        id: `${userMsg.id}-input`,
        type: "userMessage",
        content: userTextParts.map((part) => ({
          type: "text" as const,
          text: part.text,
        })),
      });
    }

    if (assistantMsg) {
      const assistantParts = partsByMessage.get(assistantMsg.id) ?? [];
      for (const part of assistantParts) {
        const mapped = partToTurnItem(part);
        if (mapped) {
          items.push(mapped);
        }
      }
    }

    turns.push({
      turnId: assistantMsg?.id ?? null,
      id: userMsg.id,
      status: resolveTurnStatus(assistantMsg),
      turnStartedAtMs: userMsg.time.created,
      finalAssistantStartedAtMs: assistantMsg?.time.created ?? null,
      error: assistantMsg?.error ?? null,
      diff: null,
      items,
    });
  }

  return turns;
}

/**
 * Chooses a deterministic assistant candidate when OpenCode emits multiple
 * assistant messages for the same user-parent relation.
 */
function shouldPreferAssistantMessage(
  candidate: OpenCodeMessage,
  existing: OpenCodeMessage,
): boolean {
  if (candidate.time.created !== existing.time.created) {
    return candidate.time.created > existing.time.created;
  }
  return candidate.id.localeCompare(existing.id) > 0;
}

function resolveTurnStatus(assistantMessage: OpenCodeMessage | null): MappedTurnStatus {
  if (assistantMessage === null) {
    return "pending";
  }
  if (assistantMessage.error !== undefined && assistantMessage.error !== null) {
    return "error";
  }
  if (COMPLETED_ASSISTANT_FINISH_REASONS.has(assistantMessage.finish ?? "")) {
    return "completed";
  }
  return "running";
}

import type { OpenCodeMessage, OpenCodePart } from "./Schemas.js";
import type { MappedTurn, MappedTurnItem } from "./MapperContracts.js";
import { isTextPart, partToTurnItem } from "./TurnItemMapper.js";

/**
 * Reconstruct turns from OpenCode messages.
 *
 * OpenCode has no first-class "turn" concept. A turn is a user message
 * paired with the assistant message that responds to it (linked via parentID).
 */
export function messagesToTurns(
  messages: OpenCodeMessage[],
  partsByMessage: Map<string, OpenCodePart[]>
): MappedTurn[] {
  const turns: MappedTurn[] = [];
  const assistantByParent = new Map<string, OpenCodeMessage>();

  for (const msg of messages) {
    if (msg.role === "assistant") {
      assistantByParent.set(msg.parentID, msg);
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
        content: userTextParts.map((part) => ({ type: "text" as const, text: part.text }))
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

    const isCompleted = assistantMsg?.finish === "stop" || assistantMsg?.finish === "length";
    const hasError = assistantMsg?.error != null;

    turns.push({
      turnId: assistantMsg?.id ?? null,
      id: userMsg.id,
      status: hasError ? "error" : isCompleted ? "completed" : assistantMsg ? "running" : "pending",
      turnStartedAtMs: userMsg.time.created,
      finalAssistantStartedAtMs: assistantMsg?.time.created ?? null,
      error: assistantMsg?.error ?? null,
      diff: null,
      items
    });
  }

  return turns;
}

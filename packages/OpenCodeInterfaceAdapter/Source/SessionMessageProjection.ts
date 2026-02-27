import type { OpenCodeMessage, OpenCodePart, OpenCodeSessionMessageEntry } from "./Schemas.js";

export interface OpenCodeSessionMessageProjection {
  messageList: OpenCodeMessage[];
  partsByMessageIdentifier: Map<string, OpenCodePart[]>;
}

/**
 * Owns message-entry projection for conversation mapping.
 * Keeps stable message order while exposing constant-time part lookups by message identifier.
 */
export function projectSessionMessages(
  messages: OpenCodeSessionMessageEntry[],
): OpenCodeSessionMessageProjection {
  const messageList: OpenCodeMessage[] = [];
  const partsByMessageIdentifier = new Map<string, OpenCodePart[]>();

  for (const entry of messages) {
    messageList.push(entry.info);
    partsByMessageIdentifier.set(entry.info.id, entry.parts);
  }

  return {
    messageList,
    partsByMessageIdentifier,
  };
}

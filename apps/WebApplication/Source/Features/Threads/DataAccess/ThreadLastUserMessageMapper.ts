import { z } from "zod";

const THREAD_TURN_ITEM_TYPE_USER_MESSAGE = "userMessage";
const THREAD_USER_MESSAGE_CONTENT_TYPE_TEXT = "text";
const OptionalThreadUserMessageTextSchema = z.union([z.string(), z.null(), z.undefined()]);

const ThreadListTurnItemWireSchema = z
  .object({
    type: z.string().min(1),
  })
  .passthrough();

const ThreadListTurnWireSchema = z
  .object({
    items: z.array(ThreadListTurnItemWireSchema),
  })
  .passthrough();

const ThreadUserMessageContentTextSchema = z
  .object({
    type: z.literal(THREAD_USER_MESSAGE_CONTENT_TYPE_TEXT),
    text: z.string(),
  })
  .strict();

const ThreadUserMessageContentSchema = z.discriminatedUnion("type", [
  ThreadUserMessageContentTextSchema,
  z
    .object({
      type: z.literal("image"),
      url: z.string(),
    })
    .strict(),
  z
    .object({
      type: z.literal("localImage"),
      path: z.string(),
    })
    .strict(),
  z
    .object({
      type: z.literal("skill"),
      name: z.string(),
      path: z.string(),
    })
    .strict(),
  z
    .object({
      type: z.literal("mention"),
      name: z.string(),
      path: z.string(),
    })
    .strict(),
]);

const ThreadUserMessageTurnItemSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal(THREAD_TURN_ITEM_TYPE_USER_MESSAGE),
    content: z.array(ThreadUserMessageContentSchema),
  })
  .strict();

export const OptionalThreadListTurnsSchema = z.array(ThreadListTurnWireSchema).optional();
type ThreadListTurnsWire = z.infer<typeof OptionalThreadListTurnsSchema>;
type ParsedThreadListTurns = z.infer<typeof ThreadListTurnWireSchema>[];

function normalizeOptionalUserMessageText(value: string | null | undefined): string | undefined {
  const parsedValue = OptionalThreadUserMessageTextSchema.parse(value);
  if (parsedValue === undefined || parsedValue === null) {
    return undefined;
  }
  const trimmedValue = parsedValue.trim();
  if (trimmedValue.length === 0) {
    return undefined;
  }
  return trimmedValue;
}

function readLatestTurnItemType(parsedTurns: ParsedThreadListTurns): string | undefined {
  for (let turnIndex = parsedTurns.length - 1; turnIndex >= 0; turnIndex -= 1) {
    const parsedTurn = parsedTurns[turnIndex];
    if (parsedTurn === undefined) {
      continue;
    }
    const turnItems = parsedTurn.items;
    for (let itemIndex = turnItems.length - 1; itemIndex >= 0; itemIndex -= 1) {
      const turnItem = turnItems[itemIndex];
      if (turnItem === undefined) {
        continue;
      }
      return turnItem.type;
    }
  }

  return undefined;
}

function readLastUserMessage(parsedTurns: ParsedThreadListTurns): string | undefined {
  for (let turnIndex = parsedTurns.length - 1; turnIndex >= 0; turnIndex -= 1) {
    const parsedTurn = parsedTurns[turnIndex];
    if (parsedTurn === undefined) {
      continue;
    }
    const turnItems = parsedTurn.items;
    for (let itemIndex = turnItems.length - 1; itemIndex >= 0; itemIndex -= 1) {
      const turnItem = turnItems[itemIndex];
      if (turnItem === undefined || turnItem.type !== THREAD_TURN_ITEM_TYPE_USER_MESSAGE) {
        continue;
      }
      const parsedUserMessageTurnItem = ThreadUserMessageTurnItemSchema.parse(turnItem);
      const userMessageTextParts: string[] = [];
      for (const userMessageContentItem of parsedUserMessageTurnItem.content) {
        if (userMessageContentItem.type !== THREAD_USER_MESSAGE_CONTENT_TYPE_TEXT) {
          continue;
        }
        const normalizedUserMessageText = normalizeOptionalUserMessageText(
          userMessageContentItem.text,
        );
        if (normalizedUserMessageText !== undefined) {
          userMessageTextParts.push(normalizedUserMessageText);
        }
      }
      const combinedUserMessageText = userMessageTextParts.join(" ").trim();
      if (combinedUserMessageText.length > 0) {
        return combinedUserMessageText;
      }
    }
  }

  return undefined;
}

export interface ThreadUserMessageProjection {
  lastUserMessage: string | undefined;
  latestActivityIsUserMessage: boolean;
}

/**
 * Extracts the newest user-authored text and latest activity ownership from trusted thread-turn payloads.
 * The mapper parses once at the boundary and fails loudly on malformed userMessage item contracts.
 */
export function readThreadUserMessageProjectionFromTurns(
  turns: ThreadListTurnsWire,
): ThreadUserMessageProjection {
  const parsedTurns = OptionalThreadListTurnsSchema.parse(turns);
  if (parsedTurns === undefined || parsedTurns.length === 0) {
    return {
      lastUserMessage: undefined,
      latestActivityIsUserMessage: false,
    };
  }

  const latestTurnItemType = readLatestTurnItemType(parsedTurns);
  return {
    lastUserMessage: readLastUserMessage(parsedTurns),
    latestActivityIsUserMessage: latestTurnItemType === THREAD_TURN_ITEM_TYPE_USER_MESSAGE,
  };
}

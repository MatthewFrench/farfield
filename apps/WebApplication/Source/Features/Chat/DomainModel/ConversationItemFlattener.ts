import { ThreadTurnSchema, TurnItemSchema } from "@farfield/protocol";
import { z } from "zod";
import {
  beginGlobalPerformanceOperation,
  completeGlobalPerformanceOperation,
} from "@/Shared/Performance/ClientPerformanceFreezeProbeOwner";

export type ConversationTurn = z.infer<typeof ThreadTurnSchema>;
export type ConversationTurnItem = z.infer<typeof TurnItemSchema>;

const TOP_SPACING_FOR_FIRST_RENDERED_ITEM_PIXELS = 0;
const TOP_SPACING_FOR_NEW_TURN_PIXELS = 16;
const TOP_SPACING_FOR_CONTINUING_TURN_PIXELS = 10;
const TURN_STATUS_IN_PROGRESS = "in-progress";
const TURN_STATUS_IN_PROGRESS_CAMEL_CASE = "inProgress";
const CONVERSATION_ITEM_FLATTEN_OPERATION = "conversation-item-flatten-in-thread";

export interface FlattenedConversationItem {
  key: string;
  item: ConversationTurnItem;
  isLast: boolean;
  turnIsInProgress: boolean;
  previousItemType?: ConversationTurnItem["type"] | undefined;
  nextItemType?: ConversationTurnItem["type"] | undefined;
  spacingTop: number;
}

const ConversationTurnItemTypeSchema = z.enum([
  "userMessage",
  "steeringUserMessage",
  "agentMessage",
  "error",
  "reasoning",
  "plan",
  "planImplementation",
  "todo-list",
  "userInputResponse",
  "commandExecution",
  "fileChange",
  "contextCompaction",
  "webSearch",
  "modelChanged",
  "mcpToolCall",
  "collabAgentToolCall",
  "collabToolCall",
  "imageView",
  "enteredReviewMode",
  "exitedReviewMode",
]);

export const FlattenedConversationItemSchema = z
  .object({
    key: z.string().min(1),
    item: TurnItemSchema,
    isLast: z.boolean(),
    turnIsInProgress: z.boolean(),
    previousItemType: ConversationTurnItemTypeSchema.optional(),
    nextItemType: ConversationTurnItemTypeSchema.optional(),
    spacingTop: z.number().finite(),
  })
  .strict();

export class ConversationItemFlattener {
  public isTurnInProgressStatus(status: ConversationTurn["status"] | null | undefined): boolean {
    return status === TURN_STATUS_IN_PROGRESS || status === TURN_STATUS_IN_PROGRESS_CAMEL_CASE;
  }

  public flattenConversationItems(
    turns: ConversationTurn[],
    isGenerating: boolean,
  ): FlattenedConversationItem[] {
    const operationToken = beginGlobalPerformanceOperation(CONVERSATION_ITEM_FLATTEN_OPERATION, {
      turnCount: turns.length,
      isGenerating,
    });
    const flattened: FlattenedConversationItem[] = [];
    let previousRenderedTurnIndex = -1;

    turns.forEach((turn, turnIndex) => {
      const items = turn.items;
      const isLastTurn = turnIndex === turns.length - 1;
      const turnInProgress = isLastTurn && isGenerating && this.isTurnInProgressStatus(turn.status);

      items.forEach((item, itemIndexInTurn) => {
        if (!this.shouldRenderConversationItem(item)) {
          return;
        }
        const isFirstRenderedItem = flattened.length === 0;
        const startsNewTurn = previousRenderedTurnIndex !== turnIndex;
        const spacingTop = isFirstRenderedItem
          ? TOP_SPACING_FOR_FIRST_RENDERED_ITEM_PIXELS
          : startsNewTurn
            ? TOP_SPACING_FOR_NEW_TURN_PIXELS
            : TOP_SPACING_FOR_CONTINUING_TURN_PIXELS;
        const previousItemType = items[itemIndexInTurn - 1]?.type;
        const nextItemType = items[itemIndexInTurn + 1]?.type;
        const flattenedItem: FlattenedConversationItem = {
          key: item.id,
          item,
          isLast: false,
          turnIsInProgress: turnInProgress,
          spacingTop,
        };
        if (previousItemType !== undefined) {
          flattenedItem.previousItemType = previousItemType;
        }
        if (nextItemType !== undefined) {
          flattenedItem.nextItemType = nextItemType;
        }
        flattened.push(flattenedItem);
        previousRenderedTurnIndex = turnIndex;
      });
    });

    const lastItemIndex = flattened.length - 1;
    if (lastItemIndex < 0) {
      completeGlobalPerformanceOperation(operationToken, "succeeded", {
        flattenedItemCount: 0,
      });
      return flattened;
    }

    const result = flattened.map((flattenedItem, flattenedItemIndex) => ({
      ...flattenedItem,
      isLast: flattenedItemIndex === lastItemIndex,
    }));
    completeGlobalPerformanceOperation(operationToken, "succeeded", {
      flattenedItemCount: result.length,
    });
    return result;
  }

  private shouldRenderConversationItem(item: ConversationTurnItem): boolean {
    switch (item.type) {
      case "userMessage":
      case "steeringUserMessage":
        return item.content.some((part) => part.type === "text" && part.text.length > 0);
      case "agentMessage":
        return item.text.length > 0;
      case "reasoning": {
        const hasSummary = item.summary?.some((line) => line.length > 0) ?? false;
        return hasSummary || Boolean(item.text);
      }
      case "userInputResponse":
        return Object.values(item.answers).some((answers) => answers.length > 0);
      default:
        return true;
    }
  }
}

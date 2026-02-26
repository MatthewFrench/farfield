import type { z } from "zod";
import type { ThreadTurnSchema, TurnItemSchema } from "@farfield/protocol";

export type ConversationTurn = z.infer<typeof ThreadTurnSchema>;
export type ConversationTurnItem = z.infer<typeof TurnItemSchema>;

const TOP_SPACING_FOR_FIRST_RENDERED_ITEM_PIXELS = 0;
const TOP_SPACING_FOR_NEW_TURN_PIXELS = 16;
const TOP_SPACING_FOR_CONTINUING_TURN_PIXELS = 10;
const TURN_STATUS_IN_PROGRESS = "in-progress";
const TURN_STATUS_IN_PROGRESS_CAMEL_CASE = "inProgress";

export interface FlattenedConversationItem {
  key: string;
  item: ConversationTurnItem;
  isLast: boolean;
  turnIsInProgress: boolean;
  previousItemType: ConversationTurnItem["type"] | undefined;
  nextItemType: ConversationTurnItem["type"] | undefined;
  spacingTop: number;
}

export class ConversationItemFlattener {
  public isTurnInProgressStatus(status: ConversationTurn["status"] | null | undefined): boolean {
    return status === TURN_STATUS_IN_PROGRESS || status === TURN_STATUS_IN_PROGRESS_CAMEL_CASE;
  }

  public flattenConversationItems(
    turns: ConversationTurn[],
    isGenerating: boolean
  ): FlattenedConversationItem[] {
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
        flattened.push({
          key: item.id ?? `${String(turnIndex)}-${String(itemIndexInTurn)}`,
          item,
          isLast: false,
          turnIsInProgress: turnInProgress,
          previousItemType: items[itemIndexInTurn - 1]?.type,
          nextItemType: items[itemIndexInTurn + 1]?.type,
          spacingTop
        });
        previousRenderedTurnIndex = turnIndex;
      });
    });

    if (flattened.length > 0) {
      flattened[flattened.length - 1]!.isLast = true;
    }

    return flattened;
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

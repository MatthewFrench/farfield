import type { TurnItemSchema } from "@farfield/protocol";
import { memo } from "react";
import type { z } from "zod";
import { resolveLocalImageSourceForRender } from "@/Features/Chat/DomainModel/LocalImageSourceResolver";
import { CommandBlock } from "./CommandBlock";
import { DiffBlock } from "./DiffBlock";
import { MarkdownText } from "./MarkdownText";
import { ReasoningBlock } from "./ReasoningBlock";

type TurnItem = z.infer<typeof TurnItemSchema>;
type UserMessageLikeItem = Extract<TurnItem, { type: "userMessage" | "steeringUserMessage" }>;
type UserInputResponseItem = Extract<TurnItem, { type: "userInputResponse" }>;

interface Props {
  item: TurnItem;
  isLast: boolean;
  turnIsInProgress: boolean;
  previousItemType?: TurnItem["type"] | undefined;
  nextItemType?: TurnItem["type"] | undefined;
}

const TOOL_BLOCK_TYPES: readonly TurnItem["type"][] = [
  "commandExecution",
  "fileChange",
  "webSearch",
  "mcpToolCall",
  "collabAgentToolCall",
  "collabToolCall",
];
// Tight spacing between adjacent tool cards keeps related tool traces visually grouped.
const TOOL_BLOCK_SPACING_CLASSES = {
  betweenToolBlocks: "my-1",
  afterToolBlock: "mt-1 mb-4",
  beforeToolBlock: "mt-4 mb-1",
  default: "my-4",
} as const;
const LINE_BREAK = "\n";
const USER_INPUT_RESPONSE_VALUE_SEPARATOR = ", ";
const REASONING_DEFAULT_SUMMARY_LINE = "Thinking…";
const EMPTY_RECEIVER_THREAD_IDS_LABEL = "none";
const ERROR_PANEL_TITLE = "Error";
const PLAN_PANEL_TITLE = "Plan";
const PLAN_IMPLEMENTATION_PANEL_TITLE = "Plan Implementation";
const PLAN_STEPS_PANEL_TITLE = "Plan Steps";
const USER_INPUT_RESPONSE_LABEL = "Response";
const CONTEXT_COMPACTED_NOTICE = "Context compacted";
const WEB_SEARCH_TOOL_TITLE = "Web search";
const MCP_TOOL_TITLE = "MCP tool";
const COLLAB_TOOL_TITLE = "Collab tool";
const VIEWED_IMAGE_PREFIX = "Viewed image:";
const ENTERED_REVIEW_MODE_PREFIX = "Entered review mode:";
const EXITED_REVIEW_MODE_PREFIX = "Exited review mode:";
const MODEL_CHANGED_NOTICE = "Model changed";
const SENDER_THREAD_LABEL = "sender:";
const RECEIVER_THREAD_LABEL = "receivers:";
const RESULT_PARTS_LABEL = "Result parts:";
const MILLISECOND_SUFFIX = "ms";
const USER_MESSAGE_WRAPPER_CLASS = "flex justify-end";
const USER_MESSAGE_BUBBLE_CLASS =
  "max-w-[80%] rounded-2xl bg-muted px-4 py-2.5 text-sm text-foreground leading-relaxed";
const USER_MESSAGE_TEXT_CLASS = "whitespace-pre-wrap break-words";
const ERROR_PANEL_CLASS = "my-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3";
const ERROR_PANEL_TITLE_CLASS =
  "text-[10px] font-semibold uppercase tracking-widest text-red-300 mb-2";
const ERROR_PANEL_TEXT_CLASS =
  "text-sm text-red-100 whitespace-pre-wrap break-words leading-relaxed";
const SECTION_PANEL_CLASS = "my-4 rounded-xl border border-border/60 bg-muted/30 px-4 py-3";
const SECTION_PANEL_TITLE_CLASS =
  "text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2";
const SECTION_PANEL_TEXT_CLASS =
  "text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed";
const USER_INPUT_RESPONSE_BUBBLE_CLASS =
  "max-w-[80%] rounded-2xl border border-border bg-muted/30 px-4 py-2.5";
const USER_INPUT_RESPONSE_LABEL_CLASS =
  "text-[10px] text-muted-foreground mb-1 uppercase tracking-wider font-medium";
const USER_INPUT_RESPONSE_TEXT_CLASS = "text-sm text-foreground whitespace-pre-wrap";
const TOOL_PANEL_CLASS = "rounded-lg border border-border bg-muted/20 px-3 py-2";
const TOOL_PANEL_TITLE_CLASS =
  "text-[10px] text-muted-foreground font-mono mb-1 uppercase tracking-wider";
const TOOL_PANEL_PRIMARY_TEXT_CLASS = "text-xs text-foreground/80 whitespace-pre-wrap break-words";
const TOOL_PANEL_SECONDARY_TEXT_CLASS =
  "text-xs text-foreground/90 whitespace-pre-wrap break-words";
const TOOL_PANEL_DURATION_TEXT_CLASS = "mt-1 text-[11px] text-muted-foreground font-mono";
const TOOL_PANEL_ERROR_TEXT_CLASS = "mt-2 text-xs text-danger whitespace-pre-wrap break-words";
const TOOL_PANEL_METADATA_TEXT_CLASS = "mt-2 text-xs text-muted-foreground";
const TOOL_PANEL_ARGUMENTS_TEXT_CLASS =
  "mt-2 text-[11px] text-muted-foreground font-mono whitespace-pre-wrap break-all";
const TOOL_PANEL_SENDER_TEXT_CLASS =
  "mt-1 text-[11px] text-muted-foreground whitespace-pre-wrap break-all";
const TOOL_PANEL_RECEIVER_TEXT_CLASS =
  "text-[11px] text-muted-foreground whitespace-pre-wrap break-all";
const TOOL_PANEL_PROMPT_TEXT_CLASS =
  "mt-2 text-xs text-foreground/80 whitespace-pre-wrap break-words";
const PLAN_STEPS_EXPLANATION_CLASS =
  "mb-2 text-sm text-foreground/90 whitespace-pre-wrap break-words leading-relaxed";
const PLAN_STEPS_LIST_CLASS = "space-y-1.5";
const PLAN_STEP_ITEM_CLASS = "text-sm text-foreground/90";
const PLAN_STEP_STATUS_CLASS =
  "mr-2 rounded border border-border/70 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground";
const PLAN_STEP_TEXT_CLASS = "whitespace-pre-wrap break-words";
const NOTICE_PANEL_CLASS =
  "rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground";
const IMAGE_VIEW_PANEL_CLASS = "my-4 rounded-xl border border-border/60 bg-muted/30 px-4 py-3";
const IMAGE_VIEW_TITLE_CLASS =
  "text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2";
const IMAGE_VIEW_IMAGE_CLASS =
  "max-h-[26rem] w-auto max-w-full rounded-lg border border-border/60 bg-background";
const IMAGE_VIEW_PATH_CLASS =
  "mt-2 text-xs text-muted-foreground whitespace-pre-wrap break-all leading-relaxed";

function isToolBlockType(type: TurnItem["type"] | undefined): boolean {
  return type !== undefined && TOOL_BLOCK_TYPES.includes(type);
}

function toolBlockSpacingClass(
  previousItemType: TurnItem["type"] | undefined,
  nextItemType: TurnItem["type"] | undefined,
): string {
  const previousIsTool = isToolBlockType(previousItemType);
  const nextIsTool = isToolBlockType(nextItemType);
  if (previousIsTool && nextIsTool) return TOOL_BLOCK_SPACING_CLASSES.betweenToolBlocks;
  if (previousIsTool) return TOOL_BLOCK_SPACING_CLASSES.afterToolBlock;
  if (nextIsTool) return TOOL_BLOCK_SPACING_CLASSES.beforeToolBlock;
  return TOOL_BLOCK_SPACING_CLASSES.default;
}

function readTextContent(content: UserMessageLikeItem["content"]): string {
  return content
    .map((part) => (part.type === "text" ? part.text : ""))
    .filter((text) => text.length > 0)
    .join("\n");
}

function readReasoningSummary(summary: string[] | undefined): string[] {
  return summary ?? [];
}

function readUserInputAnswersText(answers: UserInputResponseItem["answers"]): string {
  return Object.values(answers)
    .map((values) => values.join(USER_INPUT_RESPONSE_VALUE_SEPARATOR))
    .join(LINE_BREAK);
}

function formatReceiverThreadIds(receiverThreadIds: readonly string[]): string {
  if (receiverThreadIds.length === 0) {
    return EMPTY_RECEIVER_THREAD_IDS_LABEL;
  }
  return receiverThreadIds.join(", ");
}

function readToolPanelClassName(toolSpacing: string): string {
  return `${toolSpacing} ${TOOL_PANEL_CLASS}`;
}

function renderSectionPanel(title: string, content: string) {
  return (
    <div className={SECTION_PANEL_CLASS}>
      <div className={SECTION_PANEL_TITLE_CLASS}>{title}</div>
      <div className={SECTION_PANEL_TEXT_CLASS}>{content}</div>
    </div>
  );
}

function renderNoticePanel(content: string) {
  return <div className={NOTICE_PANEL_CLASS}>{content}</div>;
}

function renderImageViewPanel(path: string) {
  return (
    <div className={IMAGE_VIEW_PANEL_CLASS}>
      <div className={IMAGE_VIEW_TITLE_CLASS}>{VIEWED_IMAGE_PREFIX}</div>
      <img
        src={resolveLocalImageSourceForRender(path)}
        alt={`${VIEWED_IMAGE_PREFIX} ${path}`}
        loading="lazy"
        className={IMAGE_VIEW_IMAGE_CLASS}
      />
      <div className={IMAGE_VIEW_PATH_CLASS}>{path}</div>
    </div>
  );
}

function assertNever(value: never): never {
  throw new Error(`Unhandled turn item type: ${String(value)}`);
}

function ConversationItemComponent({
  item,
  isLast,
  turnIsInProgress,
  previousItemType,
  nextItemType,
}: Props) {
  const isActive = isLast && turnIsInProgress;
  const toolSpacing = toolBlockSpacingClass(previousItemType, nextItemType);

  switch (item.type) {
    /* ── User message ───────────────────────────────────── */
    case "userMessage":
    case "steeringUserMessage": {
      const text = readTextContent(item.content);
      if (text.length === 0) return null;
      return (
        <div className={USER_MESSAGE_WRAPPER_CLASS}>
          <div className={USER_MESSAGE_BUBBLE_CLASS}>
            <p className={USER_MESSAGE_TEXT_CLASS}>{text}</p>
          </div>
        </div>
      );
    }

    /* ── Agent message ──────────────────────────────────── */
    case "agentMessage":
      if (item.text.length === 0) return null;
      return <MarkdownText text={item.text} />;

    /* ── Error message ──────────────────────────────────── */
    case "error":
      return (
        <div className={ERROR_PANEL_CLASS}>
          <div className={ERROR_PANEL_TITLE_CLASS}>{ERROR_PANEL_TITLE}</div>
          <div className={ERROR_PANEL_TEXT_CLASS}>{item.message}</div>
        </div>
      );

    /* ── Reasoning ──────────────────────────────────────── */
    case "reasoning": {
      const summary = readReasoningSummary(item.summary);
      if (summary.length === 0 && (item.text === undefined || item.text.length === 0)) return null;
      return (
        <ReasoningBlock
          summary={summary.length > 0 ? summary : [REASONING_DEFAULT_SUMMARY_LINE]}
          text={item.text}
          isActive={isActive}
        />
      );
    }

    /* ── Plan ───────────────────────────────────────────── */
    case "plan":
      return renderSectionPanel(PLAN_PANEL_TITLE, item.text);

    /* ── Plan implementation ────────────────────────────── */
    case "planImplementation":
      return renderSectionPanel(PLAN_IMPLEMENTATION_PANEL_TITLE, item.planContent);

    /* ── User input response ────────────────────────────── */
    case "userInputResponse": {
      const answersText = readUserInputAnswersText(item.answers);
      if (answersText.length === 0) return null;
      return (
        <div className={USER_MESSAGE_WRAPPER_CLASS}>
          <div className={USER_INPUT_RESPONSE_BUBBLE_CLASS}>
            <div className={USER_INPUT_RESPONSE_LABEL_CLASS}>{USER_INPUT_RESPONSE_LABEL}</div>
            <div className={USER_INPUT_RESPONSE_TEXT_CLASS}>{answersText}</div>
          </div>
        </div>
      );
    }

    /* ── Command execution ──────────────────────────────── */
    case "commandExecution":
      return (
        <div className={toolSpacing}>
          <CommandBlock item={item} isActive={isActive} />
        </div>
      );

    /* ── File change ────────────────────────────────────── */
    case "fileChange":
      return (
        <div className={toolSpacing}>
          <DiffBlock changes={item.changes} />
        </div>
      );

    /* ── Context compaction ─────────────────────────────── */
    case "contextCompaction":
      return renderNoticePanel(CONTEXT_COMPACTED_NOTICE);

    /* ── Web search ─────────────────────────────────────── */
    case "webSearch":
      return (
        <div className={readToolPanelClassName(toolSpacing)}>
          <div className={TOOL_PANEL_TITLE_CLASS}>{WEB_SEARCH_TOOL_TITLE}</div>
          <div className={TOOL_PANEL_PRIMARY_TEXT_CLASS}>{item.query}</div>
        </div>
      );

    case "mcpToolCall": {
      const argumentsText = JSON.stringify(item.arguments);
      return (
        <div className={readToolPanelClassName(toolSpacing)}>
          <div className={TOOL_PANEL_TITLE_CLASS}>{MCP_TOOL_TITLE}</div>
          <div className={TOOL_PANEL_SECONDARY_TEXT_CLASS}>
            {item.server}/{item.tool} ({item.status})
          </div>
          {item.durationMs != null && (
            <div className={TOOL_PANEL_DURATION_TEXT_CLASS}>
              {item.durationMs}
              {MILLISECOND_SUFFIX}
            </div>
          )}
          {item.error?.message !== undefined && item.error.message.length > 0 && (
            <div className={TOOL_PANEL_ERROR_TEXT_CLASS}>{item.error.message}</div>
          )}
          {item.result?.content && item.result.content.length > 0 && (
            <div className={TOOL_PANEL_METADATA_TEXT_CLASS}>
              {RESULT_PARTS_LABEL} {item.result.content.length}
            </div>
          )}
          <div className={TOOL_PANEL_ARGUMENTS_TEXT_CLASS}>{argumentsText}</div>
        </div>
      );
    }

    case "collabAgentToolCall":
    case "collabToolCall":
      return (
        <div className={readToolPanelClassName(toolSpacing)}>
          <div className={TOOL_PANEL_TITLE_CLASS}>{COLLAB_TOOL_TITLE}</div>
          <div className={TOOL_PANEL_SECONDARY_TEXT_CLASS}>
            {item.tool} ({item.status})
          </div>
          <div className={TOOL_PANEL_SENDER_TEXT_CLASS}>
            {SENDER_THREAD_LABEL} {item.senderThreadId}
          </div>
          <div className={TOOL_PANEL_RECEIVER_TEXT_CLASS}>
            {RECEIVER_THREAD_LABEL} {formatReceiverThreadIds(item.receiverThreadIds)}
          </div>
          {item.prompt !== null && item.prompt !== undefined && item.prompt.length > 0 && (
            <div className={TOOL_PANEL_PROMPT_TEXT_CLASS}>{item.prompt}</div>
          )}
        </div>
      );

    case "todo-list":
      return (
        <div className={SECTION_PANEL_CLASS}>
          <div className={SECTION_PANEL_TITLE_CLASS}>{PLAN_STEPS_PANEL_TITLE}</div>
          {item.explanation !== null &&
            item.explanation !== undefined &&
            item.explanation.length > 0 && (
              <div className={PLAN_STEPS_EXPLANATION_CLASS}>{item.explanation}</div>
            )}
          <ul className={PLAN_STEPS_LIST_CLASS}>
            {item.plan.map((step, index) => (
              <li key={`${step.step}-${String(index)}`} className={PLAN_STEP_ITEM_CLASS}>
                <span className={PLAN_STEP_STATUS_CLASS}>{step.status}</span>
                <span className={PLAN_STEP_TEXT_CLASS}>{step.step}</span>
              </li>
            ))}
          </ul>
        </div>
      );

    case "imageView":
      return renderImageViewPanel(item.path);

    case "enteredReviewMode":
      return renderNoticePanel(`${ENTERED_REVIEW_MODE_PREFIX} ${item.review}`);

    case "exitedReviewMode":
      return renderNoticePanel(`${EXITED_REVIEW_MODE_PREFIX} ${item.review}`);

    case "modelChanged":
      return renderNoticePanel(MODEL_CHANGED_NOTICE);

    default:
      return assertNever(item);
  }
}

function areConversationItemPropsEqual(prev: Props, next: Props): boolean {
  return (
    prev.item === next.item &&
    prev.isLast === next.isLast &&
    prev.turnIsInProgress === next.turnIsInProgress &&
    prev.previousItemType === next.previousItemType &&
    prev.nextItemType === next.nextItemType
  );
}

export const ConversationItem = memo(ConversationItemComponent, areConversationItemPropsEqual);

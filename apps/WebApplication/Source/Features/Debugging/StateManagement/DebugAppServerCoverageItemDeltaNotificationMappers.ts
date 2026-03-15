import { type JsonValue } from "@farfield/protocol";
import { z } from "zod";
import type { CapabilityNotificationEventsResponse } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import type {
  DebugAppServerCoverageItemDeltaNotificationMethod,
  DebugAppServerCoverageItemDeltaNotificationMethodCount,
  DebugAppServerCoverageItemDeltaNotificationSummary,
  DebugAppServerCoverageItemDeltaNotificationsResult,
} from "../DomainModel/DebugAppServerCoverageContracts";

const ITEM_AGENT_MESSAGE_DELTA_NOTIFICATION_METHOD = "item/agentMessage/delta";
const ITEM_PLAN_DELTA_NOTIFICATION_METHOD = "item/plan/delta";
const ITEM_REASONING_SUMMARY_TEXT_DELTA_NOTIFICATION_METHOD = "item/reasoning/summaryTextDelta";
const ITEM_REASONING_TEXT_DELTA_NOTIFICATION_METHOD = "item/reasoning/textDelta";
const ITEM_REASONING_SUMMARY_PART_ADDED_NOTIFICATION_METHOD = "item/reasoning/summaryPartAdded";
const ITEM_COMMAND_EXECUTION_OUTPUT_DELTA_NOTIFICATION_METHOD = "item/commandExecution/outputDelta";
const ITEM_COMMAND_EXECUTION_TERMINAL_INTERACTION_NOTIFICATION_METHOD =
  "item/commandExecution/terminalInteraction";
const ITEM_FILE_CHANGE_OUTPUT_DELTA_NOTIFICATION_METHOD = "item/fileChange/outputDelta";
const ITEM_MCP_TOOL_CALL_PROGRESS_NOTIFICATION_METHOD = "item/mcpToolCall/progress";
const SUMMARY_PART_ADDED_DETAIL_TEXT = "(summary part added)";

const CommonItemDeltaParametersSchema = z
  .object({
    threadId: z.string().min(1),
    turnId: z.string().min(1),
    itemId: z.string().min(1),
    delta: z.string(),
  })
  .strict();

const ReasoningSummaryTextDeltaParametersSchema = z
  .object({
    threadId: z.string().min(1),
    turnId: z.string().min(1),
    itemId: z.string().min(1),
    delta: z.string(),
    summaryIndex: z.number().int().nonnegative(),
  })
  .strict();

const ReasoningTextDeltaParametersSchema = z
  .object({
    threadId: z.string().min(1),
    turnId: z.string().min(1),
    itemId: z.string().min(1),
    delta: z.string(),
    contentIndex: z.number().int().nonnegative(),
  })
  .strict();

const ReasoningSummaryPartAddedParametersSchema = z
  .object({
    threadId: z.string().min(1),
    turnId: z.string().min(1),
    itemId: z.string().min(1),
    summaryIndex: z.number().int().nonnegative(),
  })
  .strict();

const TerminalInteractionParametersSchema = z
  .object({
    threadId: z.string().min(1),
    turnId: z.string().min(1),
    itemId: z.string().min(1),
    processId: z.string().min(1),
    stdin: z.string(),
  })
  .strict();

const McpToolCallProgressParametersSchema = z
  .object({
    threadId: z.string().min(1),
    turnId: z.string().min(1),
    itemId: z.string().min(1),
    message: z.string(),
  })
  .strict();

function mapMethodCounts(
  events: DebugAppServerCoverageItemDeltaNotificationSummary[],
): DebugAppServerCoverageItemDeltaNotificationMethodCount[] {
  const countByMethod = new Map<DebugAppServerCoverageItemDeltaNotificationMethod, number>();
  for (const event of events) {
    const currentCount = countByMethod.get(event.method) ?? 0;
    countByMethod.set(event.method, currentCount + 1);
  }

  return [...countByMethod.entries()]
    .map(([method, count]) => ({ method, count }))
    .sort((left, right) => left.method.localeCompare(right.method));
}

function mapCommonItemDeltaEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
  method:
    | "item/agentMessage/delta"
    | "item/plan/delta"
    | "item/commandExecution/outputDelta"
    | "item/fileChange/outputDelta",
  params: JsonValue | null,
): DebugAppServerCoverageItemDeltaNotificationSummary {
  const parsedParameters = CommonItemDeltaParametersSchema.parse(params);
  return {
    method,
    sequence: event.sequence,
    threadId: parsedParameters.threadId,
    turnId: parsedParameters.turnId,
    itemId: parsedParameters.itemId,
    detailText: parsedParameters.delta,
    detailIndex: null,
    processId: null,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
  };
}

function mapReasoningSummaryTextDeltaEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
  params: JsonValue | null,
): DebugAppServerCoverageItemDeltaNotificationSummary {
  const parsedParameters = ReasoningSummaryTextDeltaParametersSchema.parse(params);
  return {
    method: ITEM_REASONING_SUMMARY_TEXT_DELTA_NOTIFICATION_METHOD,
    sequence: event.sequence,
    threadId: parsedParameters.threadId,
    turnId: parsedParameters.turnId,
    itemId: parsedParameters.itemId,
    detailText: parsedParameters.delta,
    detailIndex: parsedParameters.summaryIndex,
    processId: null,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
  };
}

function mapReasoningTextDeltaEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
  params: JsonValue | null,
): DebugAppServerCoverageItemDeltaNotificationSummary {
  const parsedParameters = ReasoningTextDeltaParametersSchema.parse(params);
  return {
    method: ITEM_REASONING_TEXT_DELTA_NOTIFICATION_METHOD,
    sequence: event.sequence,
    threadId: parsedParameters.threadId,
    turnId: parsedParameters.turnId,
    itemId: parsedParameters.itemId,
    detailText: parsedParameters.delta,
    detailIndex: parsedParameters.contentIndex,
    processId: null,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
  };
}

function mapReasoningSummaryPartAddedEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
  params: JsonValue | null,
): DebugAppServerCoverageItemDeltaNotificationSummary {
  const parsedParameters = ReasoningSummaryPartAddedParametersSchema.parse(params);
  return {
    method: ITEM_REASONING_SUMMARY_PART_ADDED_NOTIFICATION_METHOD,
    sequence: event.sequence,
    threadId: parsedParameters.threadId,
    turnId: parsedParameters.turnId,
    itemId: parsedParameters.itemId,
    detailText: SUMMARY_PART_ADDED_DETAIL_TEXT,
    detailIndex: parsedParameters.summaryIndex,
    processId: null,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
  };
}

function mapTerminalInteractionEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
  params: JsonValue | null,
): DebugAppServerCoverageItemDeltaNotificationSummary {
  const parsedParameters = TerminalInteractionParametersSchema.parse(params);
  return {
    method: ITEM_COMMAND_EXECUTION_TERMINAL_INTERACTION_NOTIFICATION_METHOD,
    sequence: event.sequence,
    threadId: parsedParameters.threadId,
    turnId: parsedParameters.turnId,
    itemId: parsedParameters.itemId,
    detailText: parsedParameters.stdin,
    detailIndex: null,
    processId: parsedParameters.processId,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
  };
}

function mapMcpToolCallProgressEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
  params: JsonValue | null,
): DebugAppServerCoverageItemDeltaNotificationSummary {
  const parsedParameters = McpToolCallProgressParametersSchema.parse(params);
  return {
    method: ITEM_MCP_TOOL_CALL_PROGRESS_NOTIFICATION_METHOD,
    sequence: event.sequence,
    threadId: parsedParameters.threadId,
    turnId: parsedParameters.turnId,
    itemId: parsedParameters.itemId,
    detailText: parsedParameters.message,
    detailIndex: null,
    processId: null,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
  };
}

export function mapItemDeltaNotificationsResult(
  response: CapabilityNotificationEventsResponse,
  sinceSequence: number | null,
): DebugAppServerCoverageItemDeltaNotificationsResult {
  const events: DebugAppServerCoverageItemDeltaNotificationSummary[] = [];
  for (const event of response.events) {
    if (event.method === ITEM_AGENT_MESSAGE_DELTA_NOTIFICATION_METHOD) {
      events.push(
        mapCommonItemDeltaEvent(event, ITEM_AGENT_MESSAGE_DELTA_NOTIFICATION_METHOD, event.params),
      );
      continue;
    }

    if (event.method === ITEM_PLAN_DELTA_NOTIFICATION_METHOD) {
      events.push(
        mapCommonItemDeltaEvent(event, ITEM_PLAN_DELTA_NOTIFICATION_METHOD, event.params),
      );
      continue;
    }

    if (event.method === ITEM_REASONING_SUMMARY_TEXT_DELTA_NOTIFICATION_METHOD) {
      events.push(mapReasoningSummaryTextDeltaEvent(event, event.params));
      continue;
    }

    if (event.method === ITEM_REASONING_TEXT_DELTA_NOTIFICATION_METHOD) {
      events.push(mapReasoningTextDeltaEvent(event, event.params));
      continue;
    }

    if (event.method === ITEM_REASONING_SUMMARY_PART_ADDED_NOTIFICATION_METHOD) {
      events.push(mapReasoningSummaryPartAddedEvent(event, event.params));
      continue;
    }

    if (event.method === ITEM_COMMAND_EXECUTION_OUTPUT_DELTA_NOTIFICATION_METHOD) {
      events.push(
        mapCommonItemDeltaEvent(
          event,
          ITEM_COMMAND_EXECUTION_OUTPUT_DELTA_NOTIFICATION_METHOD,
          event.params,
        ),
      );
      continue;
    }

    if (event.method === ITEM_COMMAND_EXECUTION_TERMINAL_INTERACTION_NOTIFICATION_METHOD) {
      events.push(mapTerminalInteractionEvent(event, event.params));
      continue;
    }

    if (event.method === ITEM_FILE_CHANGE_OUTPUT_DELTA_NOTIFICATION_METHOD) {
      events.push(
        mapCommonItemDeltaEvent(
          event,
          ITEM_FILE_CHANGE_OUTPUT_DELTA_NOTIFICATION_METHOD,
          event.params,
        ),
      );
      continue;
    }

    if (event.method === ITEM_MCP_TOOL_CALL_PROGRESS_NOTIFICATION_METHOD) {
      events.push(mapMcpToolCallProgressEvent(event, event.params));
    }
  }

  return {
    sinceSequence,
    eventCount: events.length,
    totalDetailCharacterCount: events.reduce((total, event) => total + event.detailText.length, 0),
    nextSequence: response.nextSequence,
    firstAvailableSequence: response.firstAvailableSequence,
    resetRequired: response.resetRequired,
    events,
    methodCounts: mapMethodCounts(events),
    readAtIso8601: new Date().toISOString(),
  };
}

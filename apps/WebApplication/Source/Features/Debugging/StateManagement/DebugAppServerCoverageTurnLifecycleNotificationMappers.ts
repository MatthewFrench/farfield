import { type JsonValue, JsonValueSchema } from "@farfield/protocol";
import { z } from "zod";
import type { CapabilityNotificationEventsResponse } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import type {
  DebugAppServerCoverageTurnLifecycleNotificationMethod,
  DebugAppServerCoverageTurnLifecycleNotificationMethodCount,
  DebugAppServerCoverageTurnLifecycleNotificationSummary,
  DebugAppServerCoverageTurnLifecycleNotificationsResult,
} from "../DomainModel/DebugAppServerCoverageContracts";

const TURN_STARTED_NOTIFICATION_METHOD = "turn/started";
const TURN_COMPLETED_NOTIFICATION_METHOD = "turn/completed";
const TURN_PLAN_UPDATED_NOTIFICATION_METHOD = "turn/plan/updated";
const TURN_DIFF_UPDATED_NOTIFICATION_METHOD = "turn/diff/updated";

const TurnStatusSchema = z.enum(["completed", "interrupted", "failed", "inProgress"]);
const TurnPlanStepStatusSchema = z.enum(["pending", "inProgress", "completed"]);

const TurnErrorSchema = z
  .object({
    message: z.string().min(1),
    codexErrorInfo: JsonValueSchema.nullable(),
    additionalDetails: z.string().nullable(),
  })
  .strict();

const TurnSchema = z
  .object({
    id: z.string().min(1),
    items: z.array(JsonValueSchema),
    status: TurnStatusSchema,
    error: TurnErrorSchema.nullable(),
  })
  .strict();

const TurnStartedParametersSchema = z
  .object({
    threadId: z.string().min(1),
    turn: TurnSchema,
  })
  .strict();

const TurnCompletedParametersSchema = z
  .object({
    threadId: z.string().min(1),
    turn: TurnSchema,
  })
  .strict();

const TurnPlanStepSchema = z
  .object({
    step: z.string(),
    status: TurnPlanStepStatusSchema,
  })
  .strict();

const TurnPlanUpdatedParametersSchema = z
  .object({
    threadId: z.string().min(1),
    turnId: z.string().min(1),
    explanation: z.string().nullable(),
    plan: z.array(TurnPlanStepSchema),
  })
  .strict();

const TurnDiffUpdatedParametersSchema = z
  .object({
    threadId: z.string().min(1),
    turnId: z.string().min(1),
    diff: z.string(),
  })
  .strict();

function mapMethodCounts(
  events: DebugAppServerCoverageTurnLifecycleNotificationSummary[],
): DebugAppServerCoverageTurnLifecycleNotificationMethodCount[] {
  const countByMethod = new Map<DebugAppServerCoverageTurnLifecycleNotificationMethod, number>();
  for (const event of events) {
    const currentCount = countByMethod.get(event.method) ?? 0;
    countByMethod.set(event.method, currentCount + 1);
  }

  return [...countByMethod.entries()]
    .map(([method, count]) => ({ method, count }))
    .sort((left, right) => left.method.localeCompare(right.method));
}

function mapTurnEnvelopeEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
  method: "turn/started" | "turn/completed",
  params: JsonValue | null,
): DebugAppServerCoverageTurnLifecycleNotificationSummary {
  const parsedParameters =
    method === TURN_STARTED_NOTIFICATION_METHOD
      ? TurnStartedParametersSchema.parse(params)
      : TurnCompletedParametersSchema.parse(params);
  return {
    method,
    sequence: event.sequence,
    threadId: parsedParameters.threadId,
    turnId: parsedParameters.turn.id,
    turnStatus: parsedParameters.turn.status,
    errorMessage: parsedParameters.turn.error?.message ?? null,
    planStepCount: null,
    diffLineCount: null,
    explanation: null,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
  };
}

function mapTurnPlanUpdatedEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
  params: JsonValue | null,
): DebugAppServerCoverageTurnLifecycleNotificationSummary {
  const parsedParameters = TurnPlanUpdatedParametersSchema.parse(params);
  return {
    method: TURN_PLAN_UPDATED_NOTIFICATION_METHOD,
    sequence: event.sequence,
    threadId: parsedParameters.threadId,
    turnId: parsedParameters.turnId,
    turnStatus: null,
    errorMessage: null,
    planStepCount: parsedParameters.plan.length,
    diffLineCount: null,
    explanation: parsedParameters.explanation,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
  };
}

function countDiffLines(diff: string): number {
  if (diff.length === 0) {
    return 0;
  }
  return diff.split("\n").length;
}

function mapTurnDiffUpdatedEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
  params: JsonValue | null,
): DebugAppServerCoverageTurnLifecycleNotificationSummary {
  const parsedParameters = TurnDiffUpdatedParametersSchema.parse(params);
  return {
    method: TURN_DIFF_UPDATED_NOTIFICATION_METHOD,
    sequence: event.sequence,
    threadId: parsedParameters.threadId,
    turnId: parsedParameters.turnId,
    turnStatus: null,
    errorMessage: null,
    planStepCount: null,
    diffLineCount: countDiffLines(parsedParameters.diff),
    explanation: null,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
  };
}

export function mapTurnLifecycleNotificationsResult(
  response: CapabilityNotificationEventsResponse,
  sinceSequence: number | null,
): DebugAppServerCoverageTurnLifecycleNotificationsResult {
  const events: DebugAppServerCoverageTurnLifecycleNotificationSummary[] = [];
  for (const event of response.events) {
    if (event.method === TURN_STARTED_NOTIFICATION_METHOD) {
      events.push(mapTurnEnvelopeEvent(event, TURN_STARTED_NOTIFICATION_METHOD, event.params));
      continue;
    }

    if (event.method === TURN_COMPLETED_NOTIFICATION_METHOD) {
      events.push(mapTurnEnvelopeEvent(event, TURN_COMPLETED_NOTIFICATION_METHOD, event.params));
      continue;
    }

    if (event.method === TURN_PLAN_UPDATED_NOTIFICATION_METHOD) {
      events.push(mapTurnPlanUpdatedEvent(event, event.params));
      continue;
    }

    if (event.method === TURN_DIFF_UPDATED_NOTIFICATION_METHOD) {
      events.push(mapTurnDiffUpdatedEvent(event, event.params));
    }
  }

  return {
    sinceSequence,
    eventCount: events.length,
    nextSequence: response.nextSequence,
    firstAvailableSequence: response.firstAvailableSequence,
    resetRequired: response.resetRequired,
    events,
    methodCounts: mapMethodCounts(events),
    readAtIso8601: new Date().toISOString(),
  };
}

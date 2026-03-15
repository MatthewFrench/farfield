import { type JsonValue } from "@farfield/protocol";
import { z } from "zod";
import type { CapabilityNotificationEventsResponse } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import type {
  DebugAppServerCoverageWarningNotificationMethod,
  DebugAppServerCoverageWarningNotificationMethodCount,
  DebugAppServerCoverageWarningNotificationSummary,
  DebugAppServerCoverageWarningNotificationsResult,
} from "../DomainModel/DebugAppServerCoverageContracts";

const CONFIG_WARNING_NOTIFICATION_METHOD = "configWarning";
const DEPRECATION_NOTICE_NOTIFICATION_METHOD = "deprecationNotice";
const WINDOWS_WORLD_WRITABLE_WARNING_NOTIFICATION_METHOD = "windows/worldWritableWarning";

const WarningTextPositionSchema = z
  .object({
    line: z.number().int().positive(),
    column: z.number().int().positive(),
  })
  .strict();

const WarningTextRangeSchema = z
  .object({
    start: WarningTextPositionSchema,
    end: WarningTextPositionSchema,
  })
  .strict();

const ConfigWarningParametersSchema = z
  .object({
    summary: z.string().min(1),
    details: z.string().nullable(),
    path: z.string().min(1).optional(),
    range: WarningTextRangeSchema.optional(),
  })
  .strict();

const DeprecationNoticeParametersSchema = z
  .object({
    summary: z.string().min(1),
    details: z.string().nullable(),
  })
  .strict();

const WindowsWorldWritableWarningParametersSchema = z
  .object({
    samplePaths: z.array(z.string().min(1)),
    extraCount: z.number().int().nonnegative(),
    failedScan: z.boolean(),
  })
  .strict();

function mapMethodCounts(
  events: DebugAppServerCoverageWarningNotificationSummary[],
): DebugAppServerCoverageWarningNotificationMethodCount[] {
  const countByMethod = new Map<DebugAppServerCoverageWarningNotificationMethod, number>();
  for (const event of events) {
    const currentCount = countByMethod.get(event.method) ?? 0;
    countByMethod.set(event.method, currentCount + 1);
  }

  return [...countByMethod.entries()]
    .map(([method, count]) => ({ method, count }))
    .sort((left, right) => left.method.localeCompare(right.method));
}

function mapConfigWarningEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
  params: JsonValue | null,
): DebugAppServerCoverageWarningNotificationSummary {
  const parsedParameters = ConfigWarningParametersSchema.parse(params);
  return {
    method: CONFIG_WARNING_NOTIFICATION_METHOD,
    sequence: event.sequence,
    summary: parsedParameters.summary,
    details: parsedParameters.details,
    path: parsedParameters.path ?? null,
    range: parsedParameters.range ?? null,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
  };
}

function mapDeprecationNoticeEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
  params: JsonValue | null,
): DebugAppServerCoverageWarningNotificationSummary {
  const parsedParameters = DeprecationNoticeParametersSchema.parse(params);
  return {
    method: DEPRECATION_NOTICE_NOTIFICATION_METHOD,
    sequence: event.sequence,
    summary: parsedParameters.summary,
    details: parsedParameters.details,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
  };
}

function mapWindowsWorldWritableWarningEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
  params: JsonValue | null,
): DebugAppServerCoverageWarningNotificationSummary {
  const parsedParameters = WindowsWorldWritableWarningParametersSchema.parse(params);
  return {
    method: WINDOWS_WORLD_WRITABLE_WARNING_NOTIFICATION_METHOD,
    sequence: event.sequence,
    samplePaths: parsedParameters.samplePaths,
    extraCount: parsedParameters.extraCount,
    failedScan: parsedParameters.failedScan,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
  };
}

export function mapWarningNotificationsResult(
  response: CapabilityNotificationEventsResponse,
  sinceSequence: number | null,
): DebugAppServerCoverageWarningNotificationsResult {
  const events: DebugAppServerCoverageWarningNotificationSummary[] = [];
  for (const event of response.events) {
    if (event.method === CONFIG_WARNING_NOTIFICATION_METHOD) {
      events.push(mapConfigWarningEvent(event, event.params));
      continue;
    }

    if (event.method === DEPRECATION_NOTICE_NOTIFICATION_METHOD) {
      events.push(mapDeprecationNoticeEvent(event, event.params));
      continue;
    }

    if (event.method === WINDOWS_WORLD_WRITABLE_WARNING_NOTIFICATION_METHOD) {
      events.push(mapWindowsWorldWritableWarningEvent(event, event.params));
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

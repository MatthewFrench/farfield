import { type JsonValue } from "@farfield/protocol";
import { z } from "zod";
import type { CapabilityNotificationEventsResponse } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import type {
  DebugAppServerCoverageErrorNotificationSummary,
  DebugAppServerCoverageErrorNotificationsResult,
} from "../DomainModel/DebugAppServerCoverageContracts";

const ERROR_NOTIFICATION_METHOD = "error";

const HttpStatusCodeSchema = z.number().int().nullable();
const HttpStatusCodeWrapperSchema = z
  .object({
    httpStatusCode: HttpStatusCodeSchema,
  })
  .strict();

const CodexErrorInfoSummarySchema = z.union([
  z.literal("contextWindowExceeded"),
  z.literal("usageLimitExceeded"),
  z.literal("serverOverloaded"),
  z.literal("internalServerError"),
  z.literal("unauthorized"),
  z.literal("badRequest"),
  z.literal("threadRollbackFailed"),
  z.literal("sandboxError"),
  z.literal("other"),
  z
    .object({
      httpConnectionFailed: HttpStatusCodeWrapperSchema,
    })
    .strict()
    .transform(
      (value) =>
        `httpConnectionFailed(httpStatusCode=${value.httpConnectionFailed.httpStatusCode === null ? "null" : String(value.httpConnectionFailed.httpStatusCode)})`,
    ),
  z
    .object({
      responseStreamConnectionFailed: HttpStatusCodeWrapperSchema,
    })
    .strict()
    .transform(
      (value) =>
        `responseStreamConnectionFailed(httpStatusCode=${value.responseStreamConnectionFailed.httpStatusCode === null ? "null" : String(value.responseStreamConnectionFailed.httpStatusCode)})`,
    ),
  z
    .object({
      responseStreamDisconnected: HttpStatusCodeWrapperSchema,
    })
    .strict()
    .transform(
      (value) =>
        `responseStreamDisconnected(httpStatusCode=${value.responseStreamDisconnected.httpStatusCode === null ? "null" : String(value.responseStreamDisconnected.httpStatusCode)})`,
    ),
  z
    .object({
      responseTooManyFailedAttempts: HttpStatusCodeWrapperSchema,
    })
    .strict()
    .transform(
      (value) =>
        `responseTooManyFailedAttempts(httpStatusCode=${value.responseTooManyFailedAttempts.httpStatusCode === null ? "null" : String(value.responseTooManyFailedAttempts.httpStatusCode)})`,
    ),
]);

const ErrorNotificationParametersSchema = z
  .object({
    error: z
      .object({
        message: z.string().min(1),
        codexErrorInfo: CodexErrorInfoSummarySchema.nullable(),
        additionalDetails: z.string().nullable(),
      })
      .strict(),
    willRetry: z.boolean(),
    threadId: z.string().min(1),
    turnId: z.string().min(1),
  })
  .strict();

function mapErrorNotificationEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
  params: JsonValue | null,
): DebugAppServerCoverageErrorNotificationSummary {
  const parsedParameters = ErrorNotificationParametersSchema.parse(params);
  return {
    sequence: event.sequence,
    threadId: parsedParameters.threadId,
    turnId: parsedParameters.turnId,
    message: parsedParameters.error.message,
    codexErrorInfoSummary: parsedParameters.error.codexErrorInfo,
    additionalDetails: parsedParameters.error.additionalDetails,
    willRetry: parsedParameters.willRetry,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
  };
}

export function mapErrorNotificationsResult(
  response: CapabilityNotificationEventsResponse,
  sinceSequence: number | null,
): DebugAppServerCoverageErrorNotificationsResult {
  const events = response.events
    .filter((event) => event.method === ERROR_NOTIFICATION_METHOD)
    .map((event) => mapErrorNotificationEvent(event, event.params));

  return {
    sinceSequence,
    eventCount: events.length,
    retryCount: events.filter((event) => event.willRetry).length,
    nextSequence: response.nextSequence,
    firstAvailableSequence: response.firstAvailableSequence,
    resetRequired: response.resetRequired,
    events,
    readAtIso8601: new Date().toISOString(),
  };
}

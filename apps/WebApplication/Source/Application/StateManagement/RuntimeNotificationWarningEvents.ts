import { z } from "zod";
import { type CapabilityNotificationEventsResponse } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import { type ThreadRuntimeWarningMethod } from "@/Features/Threads/DomainModel/ThreadRuntimeStatusContracts";

export const CONFIG_WARNING_NOTIFICATION_METHOD = "configWarning";
export const DEPRECATION_NOTICE_NOTIFICATION_METHOD = "deprecationNotice";
export const WINDOWS_WORLD_WRITABLE_WARNING_NOTIFICATION_METHOD = "windows/worldWritableWarning";
export const THREAD_ARCHIVED_NOTIFICATION_METHOD = "thread/archived";
export const THREAD_UNARCHIVED_NOTIFICATION_METHOD = "thread/unarchived";
export const THREAD_CLOSED_NOTIFICATION_METHOD = "thread/closed";
export const THREAD_REALTIME_STARTED_NOTIFICATION_METHOD = "thread/realtime/started";
export const THREAD_REALTIME_CLOSED_NOTIFICATION_METHOD = "thread/realtime/closed";
export const THREAD_REALTIME_ERROR_NOTIFICATION_METHOD = "thread/realtime/error";
export const ERROR_NOTIFICATION_METHOD = "error";

const ConfigWarningParametersSchema = z
  .object({
    summary: z.string().min(1),
    details: z.string().nullable(),
    path: z.string().min(1).optional(),
    range: z
      .object({
        start: z
          .object({
            line: z.number().int().positive(),
            column: z.number().int().positive(),
          })
          .strict(),
        end: z
          .object({
            line: z.number().int().positive(),
            column: z.number().int().positive(),
          })
          .strict(),
      })
      .strict()
      .optional(),
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

const ErrorNotificationParametersSchema = z
  .object({
    error: z
      .object({
        message: z.string().min(1),
      })
      .passthrough(),
    willRetry: z.boolean(),
    threadId: z.string().min(1),
    turnId: z.string().min(1),
  })
  .strict();

const ThreadRealtimeStartedParametersSchema = z
  .object({
    threadId: z.string().min(1),
    sessionId: z.string().min(1).nullable(),
  })
  .strict();

const ThreadRealtimeClosedParametersSchema = z
  .object({
    threadId: z.string().min(1),
    reason: z.string().nullable(),
  })
  .strict();

const ThreadRealtimeErrorParametersSchema = z
  .object({
    threadId: z.string().min(1),
    message: z.string().min(1),
  })
  .strict();

const ThreadLifecycleParametersSchema = z
  .object({
    threadId: z.string().min(1),
  })
  .strict();

export interface RuntimeWarningEvent {
  method: ThreadRuntimeWarningMethod;
  sequence: number;
  summary: string;
  threadId: string | null;
  isRetrying: boolean;
  receivedAtMilliseconds: number;
}

function createWarningEvent(input: {
  event: CapabilityNotificationEventsResponse["events"][number];
  method: ThreadRuntimeWarningMethod;
  summary: string;
  threadId: string | null;
  isRetrying: boolean;
}): RuntimeWarningEvent {
  return {
    method: input.method,
    sequence: input.event.sequence,
    summary: input.summary,
    threadId: input.threadId,
    isRetrying: input.isRetrying,
    receivedAtMilliseconds: input.event.receivedAtMilliseconds,
  };
}

function mapConfigWarningEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
): RuntimeWarningEvent {
  const parsedParameters = ConfigWarningParametersSchema.parse(event.params);
  return createWarningEvent({
    event,
    method: CONFIG_WARNING_NOTIFICATION_METHOD,
    summary: parsedParameters.summary,
    threadId: null,
    isRetrying: false,
  });
}

function mapDeprecationNoticeEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
): RuntimeWarningEvent {
  const parsedParameters = DeprecationNoticeParametersSchema.parse(event.params);
  return createWarningEvent({
    event,
    method: DEPRECATION_NOTICE_NOTIFICATION_METHOD,
    summary: parsedParameters.summary,
    threadId: null,
    isRetrying: false,
  });
}

function mapWindowsWorldWritableWarningEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
): RuntimeWarningEvent {
  WindowsWorldWritableWarningParametersSchema.parse(event.params);
  return createWarningEvent({
    event,
    method: WINDOWS_WORLD_WRITABLE_WARNING_NOTIFICATION_METHOD,
    summary: "World-writable paths detected",
    threadId: null,
    isRetrying: false,
  });
}

function mapErrorEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
): RuntimeWarningEvent {
  const parsedParameters = ErrorNotificationParametersSchema.parse(event.params);
  return createWarningEvent({
    event,
    method: ERROR_NOTIFICATION_METHOD,
    summary: parsedParameters.error.message,
    threadId: parsedParameters.threadId,
    isRetrying: parsedParameters.willRetry,
  });
}

function mapThreadRealtimeStartedEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
): RuntimeWarningEvent {
  const parsedParameters = ThreadRealtimeStartedParametersSchema.parse(event.params);
  return createWarningEvent({
    event,
    method: THREAD_REALTIME_STARTED_NOTIFICATION_METHOD,
    summary: "Started",
    threadId: parsedParameters.threadId,
    isRetrying: false,
  });
}

function mapThreadRealtimeClosedEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
): RuntimeWarningEvent {
  const parsedParameters = ThreadRealtimeClosedParametersSchema.parse(event.params);
  const closeSummary =
    parsedParameters.reason === null ? "Closed" : `Closed (${parsedParameters.reason})`;
  return createWarningEvent({
    event,
    method: THREAD_REALTIME_CLOSED_NOTIFICATION_METHOD,
    summary: closeSummary,
    threadId: parsedParameters.threadId,
    isRetrying: false,
  });
}

function mapThreadRealtimeErrorEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
): RuntimeWarningEvent {
  const parsedParameters = ThreadRealtimeErrorParametersSchema.parse(event.params);
  return createWarningEvent({
    event,
    method: ERROR_NOTIFICATION_METHOD,
    summary: `Realtime: ${parsedParameters.message}`,
    threadId: parsedParameters.threadId,
    isRetrying: false,
  });
}

function mapThreadArchivedEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
): RuntimeWarningEvent {
  const parsedParameters = ThreadLifecycleParametersSchema.parse(event.params);
  return createWarningEvent({
    event,
    method: THREAD_ARCHIVED_NOTIFICATION_METHOD,
    summary: "Thread archived",
    threadId: parsedParameters.threadId,
    isRetrying: false,
  });
}

function mapThreadUnarchivedEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
): RuntimeWarningEvent {
  const parsedParameters = ThreadLifecycleParametersSchema.parse(event.params);
  return createWarningEvent({
    event,
    method: THREAD_UNARCHIVED_NOTIFICATION_METHOD,
    summary: "Thread unarchived",
    threadId: parsedParameters.threadId,
    isRetrying: false,
  });
}

function mapThreadClosedEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
): RuntimeWarningEvent {
  const parsedParameters = ThreadLifecycleParametersSchema.parse(event.params);
  return createWarningEvent({
    event,
    method: THREAD_CLOSED_NOTIFICATION_METHOD,
    summary: "Thread closed",
    threadId: parsedParameters.threadId,
    isRetrying: false,
  });
}

export function mapRuntimeWarningEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
): RuntimeWarningEvent | null {
  if (event.method === CONFIG_WARNING_NOTIFICATION_METHOD) {
    return mapConfigWarningEvent(event);
  }

  if (event.method === DEPRECATION_NOTICE_NOTIFICATION_METHOD) {
    return mapDeprecationNoticeEvent(event);
  }

  if (event.method === WINDOWS_WORLD_WRITABLE_WARNING_NOTIFICATION_METHOD) {
    return mapWindowsWorldWritableWarningEvent(event);
  }

  if (event.method === ERROR_NOTIFICATION_METHOD) {
    return mapErrorEvent(event);
  }

  if (event.method === THREAD_REALTIME_STARTED_NOTIFICATION_METHOD) {
    return mapThreadRealtimeStartedEvent(event);
  }

  if (event.method === THREAD_REALTIME_CLOSED_NOTIFICATION_METHOD) {
    return mapThreadRealtimeClosedEvent(event);
  }

  if (event.method === THREAD_REALTIME_ERROR_NOTIFICATION_METHOD) {
    return mapThreadRealtimeErrorEvent(event);
  }

  if (event.method === THREAD_ARCHIVED_NOTIFICATION_METHOD) {
    return mapThreadArchivedEvent(event);
  }

  if (event.method === THREAD_UNARCHIVED_NOTIFICATION_METHOD) {
    return mapThreadUnarchivedEvent(event);
  }

  if (event.method === THREAD_CLOSED_NOTIFICATION_METHOD) {
    return mapThreadClosedEvent(event);
  }

  return null;
}

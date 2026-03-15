import { z } from "zod";
import { type CapabilityNotificationEventsResponse } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import {
  type ThreadRuntimeWarningMethod,
  type ThreadRuntimeWarningSeverity,
} from "@/Features/Threads/DomainModel/ThreadRuntimeStatusContracts";

export const CONFIG_WARNING_NOTIFICATION_METHOD = "configWarning";
export const DEPRECATION_NOTICE_NOTIFICATION_METHOD = "deprecationNotice";
export const WINDOWS_WORLD_WRITABLE_WARNING_NOTIFICATION_METHOD = "windows/worldWritableWarning";
export const MCP_SERVER_OAUTH_LOGIN_COMPLETED_NOTIFICATION_METHOD =
  "mcpServer/oauthLogin/completed";
export const ACCOUNT_LOGIN_COMPLETED_NOTIFICATION_METHOD = "account/login/completed";
export const SERVER_REQUEST_RESOLVED_NOTIFICATION_METHOD = "serverRequest/resolved";
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

const McpServerOauthLoginCompletedParametersSchema = z
  .object({
    name: z.string().min(1),
    success: z.boolean(),
    error: z.string().optional(),
  })
  .strict();

const AccountLoginCompletedParametersSchema = z
  .object({
    loginId: z.string().min(1).nullable(),
    success: z.boolean(),
    error: z.string().nullable(),
  })
  .strict();

const ServerRequestResolvedParametersSchema = z
  .object({
    threadId: z.string().min(1),
    requestId: z.number().int().nonnegative(),
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
  severity: ThreadRuntimeWarningSeverity;
  sequence: number;
  summary: string;
  threadId: string | null;
  isRetrying: boolean;
  receivedAtMilliseconds: number;
}

function createWarningEvent(input: {
  event: CapabilityNotificationEventsResponse["events"][number];
  method: ThreadRuntimeWarningMethod;
  severity: ThreadRuntimeWarningSeverity;
  summary: string;
  threadId: string | null;
  isRetrying: boolean;
}): RuntimeWarningEvent {
  return {
    method: input.method,
    severity: input.severity,
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
    severity: "warning",
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
    severity: "warning",
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
    severity: "warning",
    summary: "World-writable paths detected",
    threadId: null,
    isRetrying: false,
  });
}

function readAuthFailureMessage(
  defaultMessage: string,
  message: string | null | undefined,
): string {
  if (message === undefined || message === null) {
    return defaultMessage;
  }
  const normalizedMessage = message.trim();
  return normalizedMessage.length > 0 ? normalizedMessage : defaultMessage;
}

function mapMcpServerOauthLoginCompletedEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
): RuntimeWarningEvent {
  const parsedParameters = McpServerOauthLoginCompletedParametersSchema.parse(event.params);
  if (parsedParameters.success) {
    return createWarningEvent({
      event,
      method: MCP_SERVER_OAUTH_LOGIN_COMPLETED_NOTIFICATION_METHOD,
      severity: "success",
      summary: `MCP OAuth connected (${parsedParameters.name})`,
      threadId: null,
      isRetrying: false,
    });
  }

  const errorSummary = readAuthFailureMessage(
    "OAuth login completed without a success status.",
    parsedParameters.error,
  );
  return createWarningEvent({
    event,
    method: MCP_SERVER_OAUTH_LOGIN_COMPLETED_NOTIFICATION_METHOD,
    severity: "error",
    summary: `MCP OAuth failed (${parsedParameters.name}): ${errorSummary}`,
    threadId: null,
    isRetrying: false,
  });
}

function mapAccountLoginCompletedEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
): RuntimeWarningEvent {
  const parsedParameters = AccountLoginCompletedParametersSchema.parse(event.params);
  if (parsedParameters.success) {
    const loginIdentifier =
      parsedParameters.loginId === null ? "(no login id)" : parsedParameters.loginId;
    return createWarningEvent({
      event,
      method: ACCOUNT_LOGIN_COMPLETED_NOTIFICATION_METHOD,
      severity: "success",
      summary: `Account login completed (${loginIdentifier})`,
      threadId: null,
      isRetrying: false,
    });
  }

  const errorSummary = readAuthFailureMessage(
    "Account login completed without a success status.",
    parsedParameters.error,
  );
  return createWarningEvent({
    event,
    method: ACCOUNT_LOGIN_COMPLETED_NOTIFICATION_METHOD,
    severity: "error",
    summary: `Account login failed: ${errorSummary}`,
    threadId: null,
    isRetrying: false,
  });
}

function mapServerRequestResolvedEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
): RuntimeWarningEvent {
  const parsedParameters = ServerRequestResolvedParametersSchema.parse(event.params);
  return createWarningEvent({
    event,
    method: SERVER_REQUEST_RESOLVED_NOTIFICATION_METHOD,
    severity: "info",
    summary: `Server request #${String(parsedParameters.requestId)} resolved`,
    threadId: parsedParameters.threadId,
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
    severity: "error",
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
    severity: "realtime",
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
    severity: "realtime",
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
    severity: "error",
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
    severity: "warning",
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
    severity: "warning",
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
    severity: "warning",
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

  if (event.method === MCP_SERVER_OAUTH_LOGIN_COMPLETED_NOTIFICATION_METHOD) {
    return mapMcpServerOauthLoginCompletedEvent(event);
  }

  if (event.method === ACCOUNT_LOGIN_COMPLETED_NOTIFICATION_METHOD) {
    return mapAccountLoginCompletedEvent(event);
  }

  if (event.method === SERVER_REQUEST_RESOLVED_NOTIFICATION_METHOD) {
    return mapServerRequestResolvedEvent(event);
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

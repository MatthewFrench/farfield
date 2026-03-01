import { type JsonValue } from "@farfield/protocol";
import { z } from "zod";
import type { CapabilityNotificationEventsResponse } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import type {
  DebugAppServerCoverageAuthCompletionEventMethod,
  DebugAppServerCoverageAuthCompletionEventsResult,
  DebugAppServerCoverageAuthCompletionMethodCount,
  DebugAppServerCoverageAuthCompletionSummary,
} from "../DomainModel/DebugAppServerCoverageContracts";

const MCP_SERVER_OAUTH_COMPLETED_NOTIFICATION_METHOD = "mcpServer/oauthLogin/completed";
const ACCOUNT_LOGIN_COMPLETED_NOTIFICATION_METHOD = "account/login/completed";

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

function getFailureMessage(
  defaultMessage: string,
  message: string | null | undefined,
): string | null {
  if (message === undefined || message === null) {
    return defaultMessage;
  }

  const normalizedMessage = message.trim();
  return normalizedMessage.length > 0 ? normalizedMessage : defaultMessage;
}

function mapMethodCounts(
  events: DebugAppServerCoverageAuthCompletionSummary[],
): DebugAppServerCoverageAuthCompletionMethodCount[] {
  const countByMethod = new Map<DebugAppServerCoverageAuthCompletionEventMethod, number>();
  for (const event of events) {
    const currentCount = countByMethod.get(event.method) ?? 0;
    countByMethod.set(event.method, currentCount + 1);
  }

  return [...countByMethod.entries()]
    .map(([method, count]) => ({ method, count }))
    .sort((left, right) => left.method.localeCompare(right.method));
}

function mapMcpOauthCompletionEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
  params: JsonValue | null,
): DebugAppServerCoverageAuthCompletionSummary {
  const parsedParameters = McpServerOauthLoginCompletedParametersSchema.parse(params);
  return {
    method: MCP_SERVER_OAUTH_COMPLETED_NOTIFICATION_METHOD,
    sequence: event.sequence,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
    status: parsedParameters.success ? "success" : "error",
    subject: parsedParameters.name,
    errorMessage: parsedParameters.success
      ? null
      : getFailureMessage(
          "OAuth login completed without a success status.",
          parsedParameters.error,
        ),
  };
}

function mapAccountLoginCompletionEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
  params: JsonValue | null,
): DebugAppServerCoverageAuthCompletionSummary {
  const parsedParameters = AccountLoginCompletedParametersSchema.parse(params);
  return {
    method: ACCOUNT_LOGIN_COMPLETED_NOTIFICATION_METHOD,
    sequence: event.sequence,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
    status: parsedParameters.success ? "success" : "error",
    subject: parsedParameters.loginId ?? "(no login id)",
    errorMessage: parsedParameters.success
      ? null
      : getFailureMessage(
          "Account login completed without a success status.",
          parsedParameters.error,
        ),
  };
}

export function mapAuthCompletionEventsResult(
  response: CapabilityNotificationEventsResponse,
  sinceSequence: number | null,
): DebugAppServerCoverageAuthCompletionEventsResult {
  const completionEvents: DebugAppServerCoverageAuthCompletionSummary[] = [];

  for (const event of response.events) {
    if (event.method === MCP_SERVER_OAUTH_COMPLETED_NOTIFICATION_METHOD) {
      completionEvents.push(mapMcpOauthCompletionEvent(event, event.params));
      continue;
    }

    if (event.method === ACCOUNT_LOGIN_COMPLETED_NOTIFICATION_METHOD) {
      completionEvents.push(mapAccountLoginCompletionEvent(event, event.params));
    }
  }

  return {
    sinceSequence,
    eventCount: completionEvents.length,
    nextSequence: response.nextSequence,
    firstAvailableSequence: response.firstAvailableSequence,
    resetRequired: response.resetRequired,
    events: completionEvents,
    methodCounts: mapMethodCounts(completionEvents),
    readAtIso8601: new Date().toISOString(),
  };
}

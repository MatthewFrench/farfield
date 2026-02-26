import { CreateDebugClientErrorBodySchema } from "@farfield/protocol";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it
} from "vitest";
import {
  ApiErrorEnvelopeSchema,
  DebugErrorClearEnvelopeSchema,
  DebugErrorCreateEnvelopeSchema,
  DebugErrorDetailEnvelopeSchema,
  DebugErrorListEnvelopeSchema,
  DebugObservabilityEnvelopeSchema,
  HttpRoutesIntegrationEnvironment
} from "./HttpRoutesIntegrationEnvironment";

const DebugClientErrorsRoutePath = "/api/debug/client-errors";
const DebugClientErrorsSessionLogRoutePath = "/api/debug/client-errors/session-log";
const DebugClientErrorsSessionLogWithTrailingSlashRoutePath = "/api/debug/client-errors/session-log/";
const DebugClientErrorsSessionLogExtraRoutePath = "/api/debug/client-errors/session-log/extra";
const DebugClientErrorsMissingIdentifierWithTrailingSlashRoutePath = "/api/debug/client-errors/error_missing/";
const DebugRoutePathPrefix = "/api/debug";
const DebugHistoryRoutePathPrefix = "/api/debug/history";
const DebugTraceRoutePathPrefix = "/api/debug/trace";
const DebugObservabilityRoutePath = "/api/debug/observability";
const DebugTraceRouteWithoutDownloadPath = "/api/debug/trace/trace_missing";
const DebugRouteNearMatchClientErrorsPath = "/api/debugging/client-errors";
const DebugClientErrorsListLimit = 20;
const JsonContentTypeHeaderName = "Content-Type";
const JsonContentTypeHeaderValue = "application/json";
const MalformedIdentifier = "%E0%A4%A";
const EncodedPathSeparatorIdentifier = "%2F";
const InvalidClientErrorIdentifierErrorMessage = "Invalid client error identifier";
const NotFoundErrorMessage = "Not found";

async function expectApiErrorResponse(
  response: Response,
  expectedStatusCode: number,
  expectedError: string
): Promise<void> {
  expect(response.status).toBe(expectedStatusCode);
  const errorEnvelope = ApiErrorEnvelopeSchema.parse(await response.json());
  expect(errorEnvelope.error).toBe(expectedError);
}

function buildDebugClientErrorListRouteUrl(
  integrationEnvironment: HttpRoutesIntegrationEnvironment
): string {
  const url = new URL(integrationEnvironment.buildApiRouteUrl(DebugClientErrorsRoutePath));
  url.searchParams.set("limit", String(DebugClientErrorsListLimit));
  return url.toString();
}

describe("server route integration debug routes", () => {
  const integrationEnvironment = new HttpRoutesIntegrationEnvironment();

  beforeAll(async () => {
    await integrationEnvironment.start();
  }, 30_000);

  afterAll(async () => {
    await integrationEnvironment.stop();
  });

  it("supports debug client-error contracts", async () => {
    const authHeaders = integrationEnvironment.readAuthHeaders();

    const createBody = CreateDebugClientErrorBodySchema.parse({
      source: "web-app",
      operation: "integration:test",
      message: "integration failure",
      details: {
        key: "value"
      }
    });

    const createResponse = await fetch(integrationEnvironment.buildApiRouteUrl(DebugClientErrorsRoutePath), {
      method: "POST",
      headers: {
        ...authHeaders,
        [JsonContentTypeHeaderName]: JsonContentTypeHeaderValue
      },
      body: JSON.stringify(createBody)
    });
    expect(createResponse.status).toBe(200);
    const created = DebugErrorCreateEnvelopeSchema.parse(await createResponse.json());

    const listResponse = await fetch(buildDebugClientErrorListRouteUrl(integrationEnvironment), {
      headers: authHeaders
    });
    expect(listResponse.status).toBe(200);
    const listed = DebugErrorListEnvelopeSchema.parse(await listResponse.json());
    const listedEvent = listed.data.find((event) => event.errorId === created.errorId);
    expect(Boolean(listedEvent)).toBe(true);
    expect(listedEvent?.severity).toBe("error");

    const detailResponse = await fetch(
      integrationEnvironment.buildApiRouteUrl(
        `${DebugClientErrorsRoutePath}/${encodeURIComponent(created.errorId)}`
      ),
      {
        headers: authHeaders
      }
    );
    expect(detailResponse.status).toBe(200);
    const detail = DebugErrorDetailEnvelopeSchema.parse(await detailResponse.json());
    expect(detail.error.errorId).toBe(created.errorId);

    const sessionLogResponse = await fetch(
      integrationEnvironment.buildApiRouteUrl(DebugClientErrorsSessionLogRoutePath),
      {
        headers: authHeaders
      }
    );
    expect(sessionLogResponse.status).toBe(200);
    const sessionLog = await sessionLogResponse.text();
    expect(sessionLog.includes(created.errorId)).toBe(true);

    const clearResponse = await fetch(integrationEnvironment.buildApiRouteUrl(DebugClientErrorsRoutePath), {
      method: "DELETE",
      headers: authHeaders
    });
    expect(clearResponse.status).toBe(200);
    const cleared = DebugErrorClearEnvelopeSchema.parse(await clearResponse.json());
    expect(cleared.clearedCount).toBeGreaterThanOrEqual(1);

    const listAfterClearResponse = await fetch(buildDebugClientErrorListRouteUrl(integrationEnvironment), {
      headers: authHeaders
    });
    expect(listAfterClearResponse.status).toBe(200);
    const listedAfterClear = DebugErrorListEnvelopeSchema.parse(await listAfterClearResponse.json());
    expect(listedAfterClear.data).toEqual([]);
  });

  it("returns deterministic 400 contracts for invalid debug identifier segments", async () => {
    const authHeaders = integrationEnvironment.readAuthHeaders();

    const malformedClientErrorResponse = await fetch(
      integrationEnvironment.buildApiRouteUrl(
        `${DebugClientErrorsRoutePath}/${MalformedIdentifier}`
      ),
      {
        headers: authHeaders
      }
    );
    await expectApiErrorResponse(
      malformedClientErrorResponse,
      400,
      InvalidClientErrorIdentifierErrorMessage
    );

    const encodedPathSeparatorResponse = await fetch(
      integrationEnvironment.buildApiRouteUrl(
        `${DebugClientErrorsRoutePath}/${EncodedPathSeparatorIdentifier}`
      ),
      {
        headers: authHeaders
      }
    );
    await expectApiErrorResponse(
      encodedPathSeparatorResponse,
      400,
      InvalidClientErrorIdentifierErrorMessage
    );

    const malformedHistoryResponse = await fetch(
      integrationEnvironment.buildApiRouteUrl(`${DebugHistoryRoutePathPrefix}/${MalformedIdentifier}`),
      {
        headers: authHeaders
      }
    );
    expect(malformedHistoryResponse.status).toBe(400);
    ApiErrorEnvelopeSchema.parse(await malformedHistoryResponse.json());

    const malformedTraceResponse = await fetch(
      integrationEnvironment.buildApiRouteUrl(
        `${DebugTraceRoutePathPrefix}/${MalformedIdentifier}/download`
      ),
      {
        headers: authHeaders
      }
    );
    expect(malformedTraceResponse.status).toBe(400);
    ApiErrorEnvelopeSchema.parse(await malformedTraceResponse.json());
  });

  it("supports debug observability snapshot contracts", async () => {
    const authHeaders = integrationEnvironment.readAuthHeaders();

    const response = await fetch(integrationEnvironment.buildApiRouteUrl(DebugObservabilityRoutePath), {
      headers: authHeaders
    });

    expect(response.status).toBe(200);
    const payload = DebugObservabilityEnvelopeSchema.parse(await response.json());
    expect(payload.snapshot.cache.threadListAggregation.entryCount).toBeGreaterThanOrEqual(0);
    expect(payload.snapshot.concurrency.thread.queuedExecutionCount).toBeGreaterThanOrEqual(0);
    expect(payload.snapshot.streaming.eventStream.activeClientCount).toBeGreaterThanOrEqual(0);
    expect(payload.snapshot.routing.threadAdapterResolver.unregisteredDiscoveryAttemptCount).toBeGreaterThanOrEqual(0);
    expect(payload.snapshot.performance.requestRouting.requestLifecycleEvents.length).toBeGreaterThanOrEqual(1);
  });

  it("returns deterministic 404 contracts for unowned and near-match debug routes", async () => {
    const authHeaders = integrationEnvironment.readAuthHeaders();

    const debugPrefixResponse = await fetch(integrationEnvironment.buildApiRouteUrl(DebugRoutePathPrefix), {
      headers: authHeaders
    });
    await expectApiErrorResponse(debugPrefixResponse, 404, NotFoundErrorMessage);

    const unsupportedDebugHistoryMethodResponse = await fetch(
      integrationEnvironment.buildApiRouteUrl(DebugHistoryRoutePathPrefix),
      {
        method: "POST",
        headers: authHeaders
      }
    );
    await expectApiErrorResponse(unsupportedDebugHistoryMethodResponse, 404, NotFoundErrorMessage);

    const missingTraceDownloadSegmentResponse = await fetch(
      integrationEnvironment.buildApiRouteUrl(DebugTraceRouteWithoutDownloadPath),
      {
        headers: authHeaders
      }
    );
    await expectApiErrorResponse(missingTraceDownloadSegmentResponse, 404, NotFoundErrorMessage);

    const extraClientErrorSegmentResponse = await fetch(
      integrationEnvironment.buildApiRouteUrl(DebugClientErrorsSessionLogExtraRoutePath),
      {
        headers: authHeaders
      }
    );
    await expectApiErrorResponse(extraClientErrorSegmentResponse, 404, NotFoundErrorMessage);

    const trailingSlashSessionLogResponse = await fetch(
      integrationEnvironment.buildApiRouteUrl(DebugClientErrorsSessionLogWithTrailingSlashRoutePath),
      {
        headers: authHeaders
      }
    );
    await expectApiErrorResponse(trailingSlashSessionLogResponse, 404, NotFoundErrorMessage);

    const trailingSlashClientErrorIdentifierResponse = await fetch(
      integrationEnvironment.buildApiRouteUrl(DebugClientErrorsMissingIdentifierWithTrailingSlashRoutePath),
      {
        headers: authHeaders
      }
    );
    await expectApiErrorResponse(trailingSlashClientErrorIdentifierResponse, 404, NotFoundErrorMessage);

    const nearMatchDebugPrefixResponse = await fetch(
      integrationEnvironment.buildApiRouteUrl(DebugRouteNearMatchClientErrorsPath),
      {
        headers: authHeaders
      }
    );
    await expectApiErrorResponse(nearMatchDebugPrefixResponse, 404, NotFoundErrorMessage);
  });
});

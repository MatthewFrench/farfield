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

describe("server route integration debug routes", () => {
  const integrationEnvironment = new HttpRoutesIntegrationEnvironment();

  beforeAll(async () => {
    await integrationEnvironment.start();
  }, 30_000);

  afterAll(async () => {
    await integrationEnvironment.stop();
  });

  it("supports debug client-error contracts", async () => {
    const baseUrl = integrationEnvironment.readBaseUrl();
    const authHeaders = integrationEnvironment.readAuthHeaders();

    const createBody = CreateDebugClientErrorBodySchema.parse({
      source: "web-app",
      operation: "integration:test",
      message: "integration failure",
      details: {
        key: "value"
      }
    });

    const createResponse = await fetch(`${baseUrl}/api/debug/client-errors`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(createBody)
    });
    expect(createResponse.status).toBe(200);
    const created = DebugErrorCreateEnvelopeSchema.parse(await createResponse.json());

    const listResponse = await fetch(`${baseUrl}/api/debug/client-errors?limit=20`, {
      headers: authHeaders
    });
    expect(listResponse.status).toBe(200);
    const listed = DebugErrorListEnvelopeSchema.parse(await listResponse.json());
    const listedEvent = listed.data.find((event) => event.errorId === created.errorId);
    expect(Boolean(listedEvent)).toBe(true);
    expect(listedEvent?.severity).toBe("error");

    const detailResponse = await fetch(
      `${baseUrl}/api/debug/client-errors/${encodeURIComponent(created.errorId)}`,
      {
        headers: authHeaders
      }
    );
    expect(detailResponse.status).toBe(200);
    const detail = DebugErrorDetailEnvelopeSchema.parse(await detailResponse.json());
    expect(detail.error.errorId).toBe(created.errorId);

    const sessionLogResponse = await fetch(`${baseUrl}/api/debug/client-errors/session-log`, {
      headers: authHeaders
    });
    expect(sessionLogResponse.status).toBe(200);
    const sessionLog = await sessionLogResponse.text();
    expect(sessionLog.includes(created.errorId)).toBe(true);

    const clearResponse = await fetch(`${baseUrl}/api/debug/client-errors`, {
      method: "DELETE",
      headers: authHeaders
    });
    expect(clearResponse.status).toBe(200);
    const cleared = DebugErrorClearEnvelopeSchema.parse(await clearResponse.json());
    expect(cleared.clearedCount).toBeGreaterThanOrEqual(1);

    const listAfterClearResponse = await fetch(`${baseUrl}/api/debug/client-errors?limit=20`, {
      headers: authHeaders
    });
    expect(listAfterClearResponse.status).toBe(200);
    const listedAfterClear = DebugErrorListEnvelopeSchema.parse(await listAfterClearResponse.json());
    expect(listedAfterClear.data).toEqual([]);
  });

  it("returns 400 for malformed debug identifier segments", async () => {
    const baseUrl = integrationEnvironment.readBaseUrl();
    const authHeaders = integrationEnvironment.readAuthHeaders();
    const malformedIdentifier = "%E0%A4%A";

    const malformedClientErrorResponse = await fetch(
      `${baseUrl}/api/debug/client-errors/${malformedIdentifier}`,
      {
        headers: authHeaders
      }
    );
    expect(malformedClientErrorResponse.status).toBe(400);
    ApiErrorEnvelopeSchema.parse(await malformedClientErrorResponse.json());

    const malformedHistoryResponse = await fetch(
      `${baseUrl}/api/debug/history/${malformedIdentifier}`,
      {
        headers: authHeaders
      }
    );
    expect(malformedHistoryResponse.status).toBe(400);
    ApiErrorEnvelopeSchema.parse(await malformedHistoryResponse.json());

    const malformedTraceResponse = await fetch(
      `${baseUrl}/api/debug/trace/${malformedIdentifier}/download`,
      {
        headers: authHeaders
      }
    );
    expect(malformedTraceResponse.status).toBe(400);
    ApiErrorEnvelopeSchema.parse(await malformedTraceResponse.json());
  });

  it("supports debug observability snapshot contracts", async () => {
    const baseUrl = integrationEnvironment.readBaseUrl();
    const authHeaders = integrationEnvironment.readAuthHeaders();

    const response = await fetch(`${baseUrl}/api/debug/observability`, {
      headers: authHeaders
    });

    expect(response.status).toBe(200);
    const payload = DebugObservabilityEnvelopeSchema.parse(await response.json());
    expect(payload.snapshot.cache.threadListAggregation.entryCount).toBeGreaterThanOrEqual(0);
    expect(payload.snapshot.concurrency.thread.queuedExecutionCount).toBeGreaterThanOrEqual(0);
    expect(payload.snapshot.streaming.eventStream.activeClientCount).toBeGreaterThanOrEqual(0);
    expect(payload.snapshot.routing.threadAdapterResolver.unregisteredDiscoveryAttemptCount).toBeGreaterThanOrEqual(0);
  });
});

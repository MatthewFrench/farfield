import { describe, expect, it } from "vitest";
import {
  DebugServerClient,
  type DebugErrorListResponse,
  type DebugHistoryResponse
} from "../Source/Features/Debugging/DataAccess/DebugServerClient";
import { DebugWorkspaceDataReader } from "../Source/Features/Debugging/StateManagement/DebugWorkspaceDataReader";
import type { ApiRequestOptions } from "../Source/Shared/Contracts/ApiContracts";
type DebugErrorsResponse = DebugErrorListResponse;

interface DebugListReadCall {
  limit: number;
  requestOptions: ApiRequestOptions | undefined;
}

class TestDebugServerClient extends DebugServerClient {
  private readonly historyResponse: DebugHistoryResponse;
  private readonly debugErrorsResponse: DebugErrorsResponse;
  private readonly historyCalls: DebugListReadCall[];
  private readonly debugErrorCalls: DebugListReadCall[];

  public constructor(input: {
    historyResponse: DebugHistoryResponse;
    debugErrorsResponse: DebugErrorsResponse;
  }) {
    super();
    this.historyResponse = input.historyResponse;
    this.debugErrorsResponse = input.debugErrorsResponse;
    this.historyCalls = [];
    this.debugErrorCalls = [];
  }

  public override async listHistory(
    limit = 0,
    requestOptions?: ApiRequestOptions
  ): Promise<DebugHistoryResponse> {
    this.historyCalls.push({
      limit,
      requestOptions
    });
    return this.historyResponse;
  }

  public override async listClientErrors(
    limit = 0,
    requestOptions?: ApiRequestOptions
  ): Promise<DebugErrorsResponse> {
    this.debugErrorCalls.push({
      limit,
      requestOptions
    });
    return this.debugErrorsResponse;
  }

  public readHistoryCalls(): readonly DebugListReadCall[] {
    return this.historyCalls;
  }

  public readDebugErrorCalls(): readonly DebugListReadCall[] {
    return this.debugErrorCalls;
  }
}

describe("DebugWorkspaceDataReader", () => {
  it("loads history and debug errors as a normalized snapshot", async () => {
    const historyResponse: DebugHistoryResponse = {
      ok: true,
      history: [
        {
          id: "history-1",
          at: "2026-02-23T00:00:00.000Z",
          source: "app",
          direction: "in",
          payload: { type: "state" },
          meta: {}
        }
      ]
    };
    const debugErrorsResponse: DebugErrorsResponse = {
      ok: true,
      sessionId: "session-1",
      sessionLogPath: "/tmp/session.ndjson",
      data: [
        {
          errorId: "error-1",
          sessionId: "session-1",
          origin: "client",
          source: "farfield-web",
          operation: "read-history",
          message: "Failed to read history",
          severity: "error",
          name: null,
          stack: null,
          requestId: null,
          threadId: null,
          url: null,
          occurredAt: "2026-02-23T00:00:01.000Z",
          recordedAt: "2026-02-23T00:00:02.000Z",
          details: {}
        }
      ]
    };
    const historyRequestOptions: ApiRequestOptions = {
      actionId: "debug-history-read",
      actionName: "debug-history-read"
    };
    const debugErrorRequestOptions: ApiRequestOptions = {
      actionId: "debug-error-read",
      actionName: "debug-error-read"
    };
    const debugServerClient = new TestDebugServerClient({
      historyResponse,
      debugErrorsResponse
    });
    const reader = new DebugWorkspaceDataReader(debugServerClient);

    const snapshot = await reader.readSnapshot(120, 240, {
      historyRequestOptions,
      debugErrorsRequestOptions: debugErrorRequestOptions
    });

    expect(snapshot.history).toEqual(historyResponse.history);
    expect(snapshot.debugErrors).toEqual(debugErrorsResponse.data);
    expect(snapshot.debugErrorSessionId).toBe("session-1");
    expect(snapshot.debugErrorSessionLogPath).toBe("/tmp/session.ndjson");
    expect(snapshot.debugErrorsSignature).toEqual([
      "error-1|2026-02-23T00:00:02.000Z|Failed to read history"
    ]);
    expect(debugServerClient.readHistoryCalls()).toEqual([
      {
        limit: 120,
        requestOptions: historyRequestOptions
      }
    ]);
    expect(debugServerClient.readDebugErrorCalls()).toEqual([
      {
        limit: 240,
        requestOptions: debugErrorRequestOptions
      }
    ]);
  });
});

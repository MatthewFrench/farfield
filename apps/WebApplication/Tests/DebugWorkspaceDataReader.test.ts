import { describe, expect, it } from "vitest";
import {
  DebugServerClient,
  type DebugErrorListResponse,
  type DebugHistoryResponse
} from "../Source/Features/Debugging/DataAccess/DebugServerClient";
import { DebugWorkspaceDataReader } from "../Source/Features/Debugging/StateManagement/DebugWorkspaceDataReader";
type DebugErrorsResponse = DebugErrorListResponse;

class TestDebugServerClient extends DebugServerClient {
  private readonly historyResponse: DebugHistoryResponse;
  private readonly debugErrorsResponse: DebugErrorsResponse;

  public constructor(input: {
    historyResponse: DebugHistoryResponse;
    debugErrorsResponse: DebugErrorsResponse;
  }) {
    super();
    this.historyResponse = input.historyResponse;
    this.debugErrorsResponse = input.debugErrorsResponse;
  }

  public override async listHistory(): Promise<DebugHistoryResponse> {
    return this.historyResponse;
  }

  public override async listClientErrors(): Promise<DebugErrorsResponse> {
    return this.debugErrorsResponse;
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
    const reader = new DebugWorkspaceDataReader(
      new TestDebugServerClient({
        historyResponse,
        debugErrorsResponse
      })
    );

    const snapshot = await reader.readSnapshot(120, 240);

    expect(snapshot.history).toEqual(historyResponse.history);
    expect(snapshot.debugErrors).toEqual(debugErrorsResponse.data);
    expect(snapshot.debugErrorSessionId).toBe("session-1");
    expect(snapshot.debugErrorSessionLogPath).toBe("/tmp/session.ndjson");
    expect(snapshot.debugErrorsSignature).toEqual([
      "error-1|2026-02-23T00:00:02.000Z|Failed to read history"
    ]);
  });
});

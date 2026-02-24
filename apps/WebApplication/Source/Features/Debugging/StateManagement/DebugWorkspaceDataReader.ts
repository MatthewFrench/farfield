import type {
  DebugErrorListResponse,
  DebugHistoryResponse,
  DebugServerClient
} from "../DataAccess/DebugServerClient";

export interface DebugWorkspaceDataSnapshot {
  history: DebugHistoryResponse["history"];
  debugErrors: DebugErrorListResponse["data"];
  debugErrorSessionId: DebugErrorListResponse["sessionId"];
  debugErrorSessionLogPath: DebugErrorListResponse["sessionLogPath"];
  debugErrorsSignature: string[];
}

export class DebugWorkspaceDataReader {
  private readonly debugServerClient: DebugServerClient;

  public constructor(debugServerClient: DebugServerClient) {
    this.debugServerClient = debugServerClient;
  }

  public async readSnapshot(
    historyLimit: number,
    errorListLimit: number
  ): Promise<DebugWorkspaceDataSnapshot> {
    const [historyResponse, debugErrorsResponse] = await Promise.all([
      this.debugServerClient.listHistory(historyLimit),
      this.debugServerClient.listClientErrors(errorListLimit)
    ]);

    return {
      history: historyResponse.history,
      debugErrors: debugErrorsResponse.data,
      debugErrorSessionId: debugErrorsResponse.sessionId,
      debugErrorSessionLogPath: debugErrorsResponse.sessionLogPath,
      debugErrorsSignature: debugErrorsResponse.data.map((entry) =>
        [entry.errorId, entry.recordedAt, entry.message].join("|")
      )
    };
  }
}

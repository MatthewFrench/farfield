import type {
  DebugErrorListResponse,
  DebugHistoryResponse,
  DebugServerClient
} from "../DataAccess/DebugServerClient";
import type { ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";

export interface DebugWorkspaceDataSnapshot {
  history: DebugHistoryResponse["history"];
  debugErrors: DebugErrorListResponse["data"];
  debugErrorSessionId: DebugErrorListResponse["sessionId"];
  debugErrorSessionLogPath: DebugErrorListResponse["sessionLogPath"];
  debugErrorsSignature: string[];
}

export interface DebugWorkspaceDataReadOptions {
  historyRequestOptions?: ApiRequestOptions;
  debugErrorsRequestOptions?: ApiRequestOptions;
}

export class DebugWorkspaceDataReader {
  private readonly debugServerClient: DebugServerClient;

  public constructor(debugServerClient: DebugServerClient) {
    this.debugServerClient = debugServerClient;
  }

  public async readSnapshot(
    historyLimit: number,
    errorListLimit: number,
    options?: DebugWorkspaceDataReadOptions
  ): Promise<DebugWorkspaceDataSnapshot> {
    const [historyResponse, debugErrorsResponse] = await Promise.all([
      this.debugServerClient.listHistory(historyLimit, options?.historyRequestOptions),
      this.debugServerClient.listClientErrors(errorListLimit, options?.debugErrorsRequestOptions)
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

/**
 * Owns debug workspace snapshot reads and deterministic debug-error signature projection.
 * Signatures are state-store comparison keys; they must remain unambiguous across field values.
 */
import type {
  DebugErrorListResponse,
  DebugHistoryResponse,
  DebugServerClient
} from "../DataAccess/DebugServerClient";
import {
  buildDebugErrorSignature,
  type DebugErrorSignatureInput
} from "../DomainModel/DebugErrorSignature";
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

function readDebugErrorSignatureInput(
  debugError: DebugErrorListResponse["data"][number]
): DebugErrorSignatureInput {
  return {
    errorId: debugError.errorId,
    recordedAt: debugError.recordedAt,
    message: debugError.message
  };
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
      debugErrorsSignature: debugErrorsResponse.data.map((debugError) =>
        buildDebugErrorSignature(readDebugErrorSignatureInput(debugError))
      )
    };
  }
}

/**
 * Owns debug workspace snapshot reads and deterministic debug-error signature projection.
 * Signatures are state-store comparison keys; they must remain unambiguous across field values.
 */
import type {
  DebugErrorListResponse,
  DebugHistoryResponse,
  DebugServerClient
} from "../DataAccess/DebugServerClient";
import type { ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";

const DEBUG_ERROR_SIGNATURE_SCHEMA_VERSION = "v1";

type DebugErrorSignatureTuple = readonly [
  schemaVersion: string,
  errorId: string,
  recordedAt: string,
  message: string
];

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

function buildDebugErrorSignature(
  debugError: DebugErrorListResponse["data"][number]
): string {
  const signatureTuple: DebugErrorSignatureTuple = [
    DEBUG_ERROR_SIGNATURE_SCHEMA_VERSION,
    debugError.errorId,
    debugError.recordedAt,
    debugError.message
  ];
  return JSON.stringify(signatureTuple);
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
      debugErrorsSignature: debugErrorsResponse.data.map(buildDebugErrorSignature)
    };
  }
}

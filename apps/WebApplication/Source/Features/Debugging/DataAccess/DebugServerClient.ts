import {
  type ApiDebugErrorDetailResponse,
  type ApiDebugErrorListResponse,
  type ApiDebugHistoryDetailResponse,
  type ApiDebugHistoryResponse,
  type ApiReplayHistoryEntryInput,
  type ApiReplayHistoryEntryResponse,
  type ApiTraceStatusResponse,
  getDebugClientError,
  getHistoryEntry,
  getTraceStatus,
  listDebugClientErrors,
  listDebugHistory,
  markTrace,
  replayHistoryEntry,
  startTrace,
  stopTrace
} from "./DebugApi";
import type { ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";

export type DebugTraceStatusResponse = ApiTraceStatusResponse;
export type DebugHistoryResponse = ApiDebugHistoryResponse;
export type DebugHistoryDetailResponse = ApiDebugHistoryDetailResponse;
export type DebugErrorListResponse = ApiDebugErrorListResponse;
export type DebugErrorDetailResponse = ApiDebugErrorDetailResponse;
export type DebugReplayHistoryEntryInput = ApiReplayHistoryEntryInput;
export type DebugReplayHistoryEntryResponse = ApiReplayHistoryEntryResponse;

/**
 * Owns debug endpoint reads and trace commands.
 * Higher-level refresh cadence and merge behavior are owned by debugging state modules.
 */
export class DebugServerClient {
  public async readTraceStatus(options?: ApiRequestOptions): Promise<ApiTraceStatusResponse> {
    return getTraceStatus(options);
  }

  public async startTrace(label: string, options?: ApiRequestOptions): Promise<void> {
    return startTrace(label, options);
  }

  public async markTrace(note: string, options?: ApiRequestOptions): Promise<void> {
    return markTrace(note, options);
  }

  public async stopTrace(options?: ApiRequestOptions): Promise<void> {
    return stopTrace(options);
  }

  public async listHistory(
    limit = 120,
    options?: ApiRequestOptions
  ): Promise<ApiDebugHistoryResponse> {
    return listDebugHistory(limit, options);
  }

  public async readHistoryEntry(
    entryId: string,
    options?: ApiRequestOptions
  ): Promise<ApiDebugHistoryDetailResponse> {
    return getHistoryEntry(entryId, options);
  }

  public async listClientErrors(
    limit = 120,
    options?: ApiRequestOptions
  ): Promise<ApiDebugErrorListResponse> {
    return listDebugClientErrors(limit, options);
  }

  public async readClientError(
    errorId: string,
    options?: ApiRequestOptions
  ): Promise<ApiDebugErrorDetailResponse> {
    return getDebugClientError(errorId, options);
  }

  public async replayHistoryEntry(
    input: ApiReplayHistoryEntryInput,
    options?: ApiRequestOptions
  ): Promise<ApiReplayHistoryEntryResponse> {
    return replayHistoryEntry(input, options);
  }
}

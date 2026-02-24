import type {
  DebugHistoryDetailResponse,
  DebugReplayHistoryEntryInput
} from "../DataAccess/DebugServerClient";
import type { ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";

export interface DebugWorkspaceActionClient {
  readHistoryEntry(
    entryId: string,
    options?: ApiRequestOptions
  ): Promise<DebugHistoryDetailResponse>;
  replayHistoryEntry(
    input: DebugReplayHistoryEntryInput,
    options?: ApiRequestOptions
  ): Promise<object>;
  startTrace(label: string, options?: ApiRequestOptions): Promise<void>;
  markTrace(note: string, options?: ApiRequestOptions): Promise<void>;
  stopTrace(options?: ApiRequestOptions): Promise<void>;
}

export interface LoadDebugHistoryDetailActionInput {
  historyEntryId: string;
  debugClient: DebugWorkspaceActionClient;
  onHistoryDetailLoaded: (
    historyDetail: DebugHistoryDetailResponse | null
  ) => void;
}

export interface ReplayDebugHistoryEntryActionInput {
  replayRequest: DebugReplayHistoryEntryInput;
  debugClient: DebugWorkspaceActionClient;
  refreshCoreData: () => Promise<void>;
}

export interface StartDebugTraceActionInput {
  traceLabel: string;
  debugClient: DebugWorkspaceActionClient;
  refreshCoreData: () => Promise<void>;
}

export interface MarkDebugTraceActionInput {
  traceNote: string;
  debugClient: DebugWorkspaceActionClient;
  refreshCoreData: () => Promise<void>;
}

export interface StopDebugTraceActionInput {
  debugClient: DebugWorkspaceActionClient;
  refreshCoreData: () => Promise<void>;
}

export class DebugWorkspaceActionCoordinator {
  public async loadHistoryDetail(input: LoadDebugHistoryDetailActionInput): Promise<void> {
    if (!input.historyEntryId) {
      input.onHistoryDetailLoaded(null);
      return;
    }

    const detail = await input.debugClient.readHistoryEntry(input.historyEntryId);
    input.onHistoryDetailLoaded(detail);
  }

  public async replayHistoryEntry(input: ReplayDebugHistoryEntryActionInput): Promise<void> {
    await input.debugClient.replayHistoryEntry(input.replayRequest);
    await input.refreshCoreData();
  }

  public async startTrace(input: StartDebugTraceActionInput): Promise<void> {
    await input.debugClient.startTrace(input.traceLabel);
    await input.refreshCoreData();
  }

  public async markTrace(input: MarkDebugTraceActionInput): Promise<void> {
    await input.debugClient.markTrace(input.traceNote);
    await input.refreshCoreData();
  }

  public async stopTrace(input: StopDebugTraceActionInput): Promise<void> {
    await input.debugClient.stopTrace();
    await input.refreshCoreData();
  }
}

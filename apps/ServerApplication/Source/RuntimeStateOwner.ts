import type { CodexAgentRuntimeState } from "./Agents/Adapters/CodexAgent.js";
import type { TraceSummary } from "./Network/Routes/DebugTypes.js";

export interface RuntimeStateSnapshot {
  appExecutable: string;
  socketPath: string;
  workspaceDir: string;
  gitCommit: string | null;
  appReady: boolean;
  ipcConnected: boolean;
  ipcInitialized: boolean;
  codexAvailable: boolean;
  lastError: string | null;
  historyCount: number;
  threadOwnerCount: number;
  pushEnabled: boolean;
  pushSubscriptionCount: number;
  pushReceiptCount: number;
  clientErrorCount: number;
  activeTrace: TraceSummary | null;
}

export interface RuntimeStateReadModel {
  appExecutable: string;
  socketPath: string;
  workspaceDir: string;
  gitCommit: string | null;
  readCodexRuntimeState: () => CodexAgentRuntimeState | null;
  readHistoryCount: () => number;
  readThreadOwnerCount: () => number;
  readPushEnabled: () => boolean;
  readPushSubscriptionCount: () => number;
  readPushReceiptCount: () => number;
  readClientErrorCount: () => number;
  readActiveTraceSummary: () => TraceSummary | null;
}

export class RuntimeStateOwner {
  private readonly readModel: RuntimeStateReadModel;
  private runtimeLastError: string | null;

  public constructor(readModel: RuntimeStateReadModel) {
    this.readModel = readModel;
    this.runtimeLastError = null;
  }

  public setRuntimeLastError(message: string | null): void {
    this.runtimeLastError = message;
  }

  public readRuntimeLastError(): string | null {
    return this.runtimeLastError;
  }

  public readSnapshot(): RuntimeStateSnapshot {
    const codexRuntimeState = this.readModel.readCodexRuntimeState();

    return {
      appExecutable: this.readModel.appExecutable,
      socketPath: this.readModel.socketPath,
      workspaceDir: this.readModel.workspaceDir,
      gitCommit: this.readModel.gitCommit,
      appReady: codexRuntimeState?.appReady ?? false,
      ipcConnected: codexRuntimeState?.ipcConnected ?? false,
      ipcInitialized: codexRuntimeState?.ipcInitialized ?? false,
      codexAvailable: codexRuntimeState?.codexAvailable ?? false,
      lastError: this.runtimeLastError ?? codexRuntimeState?.lastError ?? null,
      historyCount: this.readModel.readHistoryCount(),
      threadOwnerCount: this.readModel.readThreadOwnerCount(),
      pushEnabled: this.readModel.readPushEnabled(),
      pushSubscriptionCount: this.readModel.readPushSubscriptionCount(),
      pushReceiptCount: this.readModel.readPushReceiptCount(),
      clientErrorCount: this.readModel.readClientErrorCount(),
      activeTrace: this.readModel.readActiveTraceSummary()
    };
  }
}

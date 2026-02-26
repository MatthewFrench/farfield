import type { CodexAgentRuntimeState } from "../../Agents/Adapters/CodexAgentAdapter.js";
import type { TraceSummary } from "../../Network/Routes/DebugTypes.js";

// Keep runtime snapshot reads cheap while still allowing near-real-time diagnostics refresh.
const DEFAULT_SNAPSHOT_CACHE_TIME_TO_LIVE_MILLISECONDS = 250;
const EMPTY_CACHE_TIMESTAMP_EPOCH_MILLISECONDS = -1;

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
  private readonly snapshotCacheTimeToLiveMs: number;
  private runtimeLastError: string | null;
  private cachedSnapshot: RuntimeStateSnapshot | null;
  private cachedSnapshotAtEpochMs: number;

  public constructor(
    readModel: RuntimeStateReadModel,
    snapshotCacheTimeToLiveMs = DEFAULT_SNAPSHOT_CACHE_TIME_TO_LIVE_MILLISECONDS
  ) {
    if (!Number.isInteger(snapshotCacheTimeToLiveMs) || snapshotCacheTimeToLiveMs < 0) {
      throw new Error("RuntimeStateOwner requires non-negative integer snapshotCacheTimeToLiveMs");
    }
    this.readModel = readModel;
    this.snapshotCacheTimeToLiveMs = snapshotCacheTimeToLiveMs;
    this.runtimeLastError = null;
    this.cachedSnapshot = null;
    this.cachedSnapshotAtEpochMs = EMPTY_CACHE_TIMESTAMP_EPOCH_MILLISECONDS;
  }

  public setRuntimeLastError(message: string | null): void {
    this.runtimeLastError = message;
    this.cachedSnapshot = null;
    this.cachedSnapshotAtEpochMs = EMPTY_CACHE_TIMESTAMP_EPOCH_MILLISECONDS;
  }

  public readRuntimeLastError(): string | null {
    return this.runtimeLastError;
  }

  public readSnapshot(nowEpochMs: number = Date.now()): RuntimeStateSnapshot {
    if (!Number.isFinite(nowEpochMs)) {
      throw new Error("RuntimeStateOwner requires finite nowEpochMs");
    }

    const cacheAgeMilliseconds = nowEpochMs - this.cachedSnapshotAtEpochMs;
    if (
      this.cachedSnapshot
      && cacheAgeMilliseconds >= 0
      && cacheAgeMilliseconds <= this.snapshotCacheTimeToLiveMs
    ) {
      return this.cachedSnapshot;
    }

    const codexRuntimeState = this.readModel.readCodexRuntimeState();
    const snapshot: RuntimeStateSnapshot = {
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

    this.cachedSnapshot = snapshot;
    this.cachedSnapshotAtEpochMs = nowEpochMs;
    return snapshot;
  }
}

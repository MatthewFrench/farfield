import {
  AppServerClient,
  AppServerTransportError,
  type DesktopIpcClient
} from "@farfield/api";
import { logger } from "../../Shared/Logging/Logger.js";
import type { CodexAgentRuntimeState } from "./CodexAgentAdapter.js";

interface DesktopIpcConnectionStateSnapshot {
  connected: boolean;
  reason?: string | null;
}

export interface CodexConnectionLifecycleOwnerOptions {
  appClient: AppServerClient;
  ipcClient: DesktopIpcClient;
  label: string;
  reconnectDelayMs: number;
  onStateChange?: (() => void) | null;
}

export class CodexConnectionLifecycleOwner {
  private readonly appClient: AppServerClient;
  private readonly ipcClient: DesktopIpcClient;
  private readonly label: string;
  private readonly reconnectDelayMs: number;
  private readonly onStateChange: (() => void) | null;

  private runtimeState: CodexAgentRuntimeState = {
    appReady: false,
    ipcConnected: false,
    ipcInitialized: false,
    codexAvailable: true,
    lastError: null
  };

  private bootstrapInFlight: Promise<void> | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private started = false;

  public constructor(options: CodexConnectionLifecycleOwnerOptions) {
    this.appClient = options.appClient;
    this.ipcClient = options.ipcClient;
    this.label = options.label;
    this.reconnectDelayMs = options.reconnectDelayMs;
    this.onStateChange = options.onStateChange ?? null;
  }

  public getRuntimeState(): CodexAgentRuntimeState {
    return { ...this.runtimeState };
  }

  public isConnected(): boolean {
    return this.runtimeState.codexAvailable && this.runtimeState.appReady;
  }

  public isIpcReady(): boolean {
    return this.runtimeState.ipcConnected && this.runtimeState.ipcInitialized;
  }

  public markStarted(): void {
    this.started = true;
  }

  public markStopped(): void {
    this.started = false;
    this.clearReconnectTimer();
  }

  public clearReconnectTimer(): void {
    if (!this.reconnectTimer) {
      return;
    }

    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  public handleIpcConnectionState(state: DesktopIpcConnectionStateSnapshot): void {
    this.patchRuntimeState({
      ipcConnected: state.connected,
      ipcInitialized: state.connected ? this.runtimeState.ipcInitialized : false,
      ...(state.reason ? { lastError: state.reason } : {})
    });

    if (!state.connected) {
      this.scheduleIpcReconnect();
      return;
    }

    this.clearReconnectTimer();
  }

  public ensureCodexAvailable(): void {
    if (!this.runtimeState.codexAvailable) {
      throw new Error("Codex backend is not available");
    }
  }

  public ensureIpcReady(): void {
    if (!this.isIpcReady()) {
      throw new Error(this.runtimeState.lastError ?? "Desktop IPC is not connected");
    }
  }

  public async runAppServerCall<ValueType>(operation: () => Promise<ValueType>): Promise<ValueType> {
    try {
      const result = await operation();
      this.patchRuntimeState({
        appReady: true,
        lastError: null
      });
      return result;
    } catch (error) {
      this.patchRuntimeState({
        appReady: !(error instanceof AppServerTransportError),
        lastError: toErrorMessage(error)
      });
      throw error;
    }
  }

  public async bootstrapConnections(): Promise<void> {
    if (this.bootstrapInFlight) {
      return this.bootstrapInFlight;
    }

    this.bootstrapInFlight = (async () => {
      try {
        await this.runAppServerCall(() =>
          this.appClient.listThreads({ limit: 1, archived: false, sortKey: "updated_at" })
        );
      } catch (error) {
        const message = toErrorMessage(error);
        const isSpawnError = message.includes("ENOENT") ||
          message.includes("not found") ||
          (error instanceof Error && "code" in error &&
            (error as NodeJS.ErrnoException).code === "ENOENT");

        if (isSpawnError) {
          this.patchRuntimeState({
            codexAvailable: false,
            lastError: message
          });
          logger.warn({ error: message }, "codex-not-found");
        }
      }

      if (!this.runtimeState.codexAvailable) {
        this.bootstrapInFlight = null;
        return;
      }

      try {
        if (!this.ipcClient.isConnected()) {
          await this.ipcClient.connect();
        }
        this.patchRuntimeState({
          ipcConnected: true
        });

        await this.ipcClient.initialize(this.label);
        this.patchRuntimeState({
          ipcInitialized: true
        });
      } catch (error) {
        this.patchRuntimeState({
          ipcInitialized: false,
          ipcConnected: this.ipcClient.isConnected(),
          lastError: toErrorMessage(error)
        });
        this.scheduleIpcReconnect();
      } finally {
        this.bootstrapInFlight = null;
      }
    })();

    return this.bootstrapInFlight;
  }

  private scheduleIpcReconnect(): void {
    if (this.reconnectTimer || !this.runtimeState.codexAvailable || !this.started) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.bootstrapConnections();
    }, this.reconnectDelayMs);
  }

  private notifyStateChanged(): void {
    if (this.onStateChange) {
      this.onStateChange();
    }
  }

  private setRuntimeState(next: CodexAgentRuntimeState): void {
    const isSameState = this.runtimeState.appReady === next.appReady
      && this.runtimeState.ipcConnected === next.ipcConnected
      && this.runtimeState.ipcInitialized === next.ipcInitialized
      && this.runtimeState.codexAvailable === next.codexAvailable
      && this.runtimeState.lastError === next.lastError;

    if (isSameState) {
      return;
    }

    this.runtimeState = next;
    this.notifyStateChanged();
  }

  private patchRuntimeState(patch: Partial<CodexAgentRuntimeState>): void {
    this.setRuntimeState({
      ...this.runtimeState,
      ...patch
    });
  }
}

function toErrorMessage<ErrorType>(error: ErrorType): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}

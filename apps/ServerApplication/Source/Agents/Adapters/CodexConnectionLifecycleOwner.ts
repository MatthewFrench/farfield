import {
  AppServerClient,
  AppServerTransportError,
  type ListThreadsOptions,
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

const CODEX_UNAVAILABLE_ERROR_PATTERNS = [
  /\bENOENT\b/i,
  /\bnot\s+found\b/i
];
const CODEX_UNAVAILABLE_LOG_EVENT = "codex-not-found";
const CONNECTION_ERROR_MESSAGES = {
  codexUnavailable: "Codex backend is not available",
  ipcNotConnected: "Desktop IPC is not connected"
} as const;
const APP_SERVER_BOOTSTRAP_LIST_THREADS_OPTIONS: ListThreadsOptions = {
  limit: 1,
  archived: false,
  sortKey: "updated_at"
};
const INITIAL_RUNTIME_STATE: CodexAgentRuntimeState = {
  appReady: false,
  ipcConnected: false,
  ipcInitialized: false,
  codexAvailable: true,
  lastError: null
};

/**
 * Owns Codex app-server and IPC connection lifecycle state for the adapter.
 * Reconnect attempts are intentionally serialized through one timer and one bootstrap promise.
 */
export class CodexConnectionLifecycleOwner {
  private readonly appClient: AppServerClient;
  private readonly ipcClient: DesktopIpcClient;
  private readonly label: string;
  private readonly reconnectDelayMs: number;
  private readonly onStateChange: (() => void) | null;

  private runtimeState: CodexAgentRuntimeState = { ...INITIAL_RUNTIME_STATE };

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
    const statePatch: Partial<CodexAgentRuntimeState> = {
      ipcConnected: state.connected,
      ipcInitialized: state.connected ? this.runtimeState.ipcInitialized : false
    };
    if (state.reason !== null && state.reason !== undefined && state.reason.length > 0) {
      statePatch.lastError = state.reason;
    }
    this.patchRuntimeState(statePatch);

    if (state.connected) {
      this.clearReconnectTimer();
      return;
    }

    this.scheduleIpcReconnect();
  }

  public ensureCodexAvailable(): void {
    if (!this.runtimeState.codexAvailable) {
      throw new Error(CONNECTION_ERROR_MESSAGES.codexUnavailable);
    }
  }

  public ensureIpcReady(): void {
    if (!this.isIpcReady()) {
      throw new Error(this.runtimeState.lastError ?? CONNECTION_ERROR_MESSAGES.ipcNotConnected);
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

    this.bootstrapInFlight = this.runBootstrapConnections();

    return this.bootstrapInFlight;
  }

  private async runBootstrapConnections(): Promise<void> {
    try {
      await this.bootstrapAppServerReadiness();

      if (!this.runtimeState.codexAvailable) {
        return;
      }

      await this.bootstrapIpcReadiness();
    } finally {
      this.bootstrapInFlight = null;
    }
  }

  private async bootstrapAppServerReadiness(): Promise<void> {
    try {
      await this.runAppServerCall(() =>
        this.appClient.listThreads(APP_SERVER_BOOTSTRAP_LIST_THREADS_OPTIONS)
      );
    } catch (error) {
      const message = toErrorMessage(error);
      if (isCodexUnavailableBootstrapErrorMessage(message)) {
        this.markCodexUnavailable(message);
      }
    }
  }

  private markCodexUnavailable(message: string): void {
    this.patchRuntimeState({
      codexAvailable: false,
      lastError: message
    });
    logger.warn({ error: message }, CODEX_UNAVAILABLE_LOG_EVENT);
  }

  private async bootstrapIpcReadiness(): Promise<void> {
    try {
      await this.connectIpcIfNeeded();
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
    }
  }

  private async connectIpcIfNeeded(): Promise<void> {
    if (this.ipcClient.isConnected()) {
      return;
    }

    await this.ipcClient.connect();
  }

  private scheduleIpcReconnect(): void {
    if (!this.shouldScheduleIpcReconnect()) {
      return;
    }

    // Reconnect scheduling is single-flight so repeated disconnect events do not fan out retries.
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.bootstrapConnections();
    }, this.reconnectDelayMs);
  }

  private shouldScheduleIpcReconnect(): boolean {
    return this.reconnectTimer === null
      && this.runtimeState.codexAvailable
      && this.started;
  }

  private notifyStateChanged(): void {
    if (this.onStateChange) {
      this.onStateChange();
    }
  }

  private setRuntimeState(next: CodexAgentRuntimeState): void {
    if (isSameRuntimeState(this.runtimeState, next)) {
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

function isSameRuntimeState(
  current: CodexAgentRuntimeState,
  next: CodexAgentRuntimeState
): boolean {
  return current.appReady === next.appReady
    && current.ipcConnected === next.ipcConnected
    && current.ipcInitialized === next.ipcInitialized
    && current.codexAvailable === next.codexAvailable
    && current.lastError === next.lastError;
}

export function isCodexUnavailableBootstrapErrorMessage(message: string): boolean {
  return CODEX_UNAVAILABLE_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

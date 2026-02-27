import {
  AppServerClient,
  AppServerRpcError,
  CodexMonitorService,
  DesktopIpcClient,
  type SendRequestOptions,
} from "@farfield/api";
import type {
  AppServerCollaborationModeListResponse,
  AppServerListModelsResponse,
  IpcFrame,
  IpcRequestFrame,
  IpcResponseFrame,
} from "@farfield/protocol";
import type {
  AgentAdapter,
  AgentCapabilities,
  AgentConfigDefaults,
  AgentCreateThreadInput,
  AgentCreateThreadResult,
  AgentInterruptInput,
  AgentListThreadsInput,
  AgentListThreadsResult,
  AgentReadStreamEventsInput,
  AgentReadThreadInput,
  AgentReadThreadResult,
  AgentSendMessageInput,
  AgentSetCollaborationModeInput,
  AgentSubmitUserInputInput,
  AgentThreadLiveState,
  AgentThreadStreamEvents,
} from "../Types.js";
import { CodexAppServerStderrOwner } from "./CodexAppServerStderrOwner.js";
import { CodexConnectionLifecycleOwner } from "./CodexConnectionLifecycleOwner.js";
import { CodexMessageDispatchOwner } from "./CodexMessageDispatchOwner.js";
import { CodexThreadInteractionOwner } from "./CodexThreadInteractionOwner.js";
import { CodexThreadManagementOwner } from "./CodexThreadManagementOwner.js";
import { CodexThreadStreamStateOwner } from "./CodexThreadStreamStateOwner.js";

const CODEX_AGENT_IDENTIFIER = "codex";
const CODEX_AGENT_LABEL = "Codex";
const APP_SERVER_INVALID_REQUEST_ERROR_CODE = -32600;
const APP_SERVER_INVALID_REQUEST_MESSAGE_FRAGMENT = {
  threadNotLoaded: "thread not loaded",
  conversationNotFound: "conversation not found",
} as const;
const STEERING_UNSUPPORTED_ENDPOINT_ERROR = "Steering messages are not supported on this endpoint.";

export interface CodexAgentRuntimeState {
  appReady: boolean;
  ipcConnected: boolean;
  ipcInitialized: boolean;
  codexAvailable: boolean;
  lastError: string | null;
}

export interface CodexIpcFrameEvent {
  direction: "in" | "out";
  frame: IpcFrame;
  method: string;
  threadId: string | null;
}

const INBOUND_IPC_FRAME_DIRECTION: CodexIpcFrameEvent["direction"] = "in";
const CODEX_AGENT_CAPABILITIES: AgentCapabilities = {
  canListModels: true,
  canListCollaborationModes: true,
  canSetCollaborationMode: true,
  canSubmitUserInput: true,
  canReadLiveState: true,
  canReadStreamEvents: true,
};

export interface CodexAgentOptions {
  appExecutable: string;
  appServerBaseEnvironment: NodeJS.ProcessEnv;
  socketPath: string;
  invalidStreamEventsLogPath: string;
  workspaceDir: string;
  userAgent: string;
  reconnectDelayMs: number;
  onStateChange?: () => void;
}

function isInvalidRequestErrorMatchingMessageFragment<ErrorType>(
  error: ErrorType,
  messageFragment: string,
): boolean {
  if (!(error instanceof AppServerRpcError)) {
    return false;
  }

  if (error.code !== APP_SERVER_INVALID_REQUEST_ERROR_CODE) {
    return false;
  }

  return error.message.includes(messageFragment);
}

/**
 * Owns Codex adapter composition and delegates behavior to connection/thread owners.
 * This class keeps wiring explicit so owner responsibilities stay isolated and testable.
 */
export class CodexAgentAdapter implements AgentAdapter {
  public readonly id = CODEX_AGENT_IDENTIFIER;
  public readonly label = CODEX_AGENT_LABEL;
  public readonly capabilities: AgentCapabilities = CODEX_AGENT_CAPABILITIES;

  private readonly appClient: AppServerClient;
  private readonly ipcClient: DesktopIpcClient;
  private readonly service: CodexMonitorService;
  private readonly appServerStderrOwner: CodexAppServerStderrOwner;
  private readonly threadStreamStateOwner: CodexThreadStreamStateOwner;
  private readonly connectionLifecycleOwner: CodexConnectionLifecycleOwner;
  private readonly messageDispatchOwner: CodexMessageDispatchOwner;
  private readonly threadManagementOwner: CodexThreadManagementOwner;
  private readonly threadInteractionOwner: CodexThreadInteractionOwner;
  private readonly workspaceDir: string;

  private readonly ipcFrameListeners = new Set<(event: CodexIpcFrameEvent) => void>();

  public constructor(options: CodexAgentOptions) {
    this.workspaceDir = options.workspaceDir;
    this.appServerStderrOwner = new CodexAppServerStderrOwner();
    this.threadStreamStateOwner = new CodexThreadStreamStateOwner({
      invalidStreamEventsLogPath: options.invalidStreamEventsLogPath,
    });

    this.appClient = new AppServerClient({
      executablePath: options.appExecutable,
      baseEnvironment: options.appServerBaseEnvironment,
      userAgent: options.userAgent,
      cwd: options.workspaceDir,
      onStderr: (line) => {
        this.appServerStderrOwner.handleStderrLine(line);
      },
    });

    this.ipcClient = new DesktopIpcClient({
      socketPath: options.socketPath,
    });
    this.service = new CodexMonitorService(this.ipcClient);
    this.connectionLifecycleOwner = new CodexConnectionLifecycleOwner({
      appClient: this.appClient,
      ipcClient: this.ipcClient,
      label: this.label,
      reconnectDelayMs: options.reconnectDelayMs,
      onStateChange: options.onStateChange ?? null,
    });
    const runAppServerCall = async <ValueType>(
      operation: () => Promise<ValueType>,
    ): Promise<ValueType> => {
      return this.connectionLifecycleOwner.runAppServerCall(operation);
    };
    this.messageDispatchOwner = new CodexMessageDispatchOwner({
      appClient: this.appClient,
      service: this.service,
      threadStreamStateOwner: this.threadStreamStateOwner,
      runAppServerCall,
      isConversationNotFoundError: <ErrorType>(error: ErrorType): boolean => {
        return this.isConversationNotFoundError(error);
      },
    });
    this.threadManagementOwner = new CodexThreadManagementOwner({
      appClient: this.appClient,
      runAppServerCall,
      ensureCodexAvailable: () => {
        this.ensureCodexAvailable();
      },
    });
    this.threadInteractionOwner = new CodexThreadInteractionOwner({
      service: this.service,
      ipcClient: this.ipcClient,
      threadStreamStateOwner: this.threadStreamStateOwner,
      ensureCodexAvailable: () => {
        this.ensureCodexAvailable();
      },
      ensureIpcReady: () => {
        this.ensureIpcReady();
      },
      emitIpcFrame: (event) => {
        this.emitIpcFrame(event);
      },
    });

    this.ipcClient.onConnectionState((state) => {
      this.connectionLifecycleOwner.handleIpcConnectionState(state);
    });

    this.ipcClient.onFrame((frame) => {
      const frameDescription = this.threadStreamStateOwner.describeFrame(frame);

      this.emitIpcFrame({
        direction: INBOUND_IPC_FRAME_DIRECTION,
        frame,
        method: frameDescription.method,
        threadId: frameDescription.threadId,
      });
      this.threadStreamStateOwner.ingestInboundFrame(frame);
    });
  }

  public onIpcFrame(listener: (event: CodexIpcFrameEvent) => void): () => void {
    this.ipcFrameListeners.add(listener);
    return () => {
      this.ipcFrameListeners.delete(listener);
    };
  }

  public getRuntimeState(): CodexAgentRuntimeState {
    return this.connectionLifecycleOwner.getRuntimeState();
  }

  public getThreadOwnerCount(): number {
    return this.threadStreamStateOwner.getThreadOwnerCount();
  }

  public isThreadNotLoadedError(error: Error): boolean {
    return isInvalidRequestErrorMatchingMessageFragment(
      error,
      APP_SERVER_INVALID_REQUEST_MESSAGE_FRAGMENT.threadNotLoaded,
    );
  }

  public isConversationNotFoundError<ErrorType>(error: ErrorType): boolean {
    return isInvalidRequestErrorMatchingMessageFragment(
      error,
      APP_SERVER_INVALID_REQUEST_MESSAGE_FRAGMENT.conversationNotFound,
    );
  }

  public isEnabled(): boolean {
    return true;
  }

  public isConnected(): boolean {
    return this.connectionLifecycleOwner.isConnected();
  }

  public isIpcReady(): boolean {
    return this.connectionLifecycleOwner.isIpcReady();
  }

  public async start(): Promise<void> {
    this.connectionLifecycleOwner.markStarted();
    await this.connectionLifecycleOwner.bootstrapConnections();
  }

  public async stop(): Promise<void> {
    this.connectionLifecycleOwner.markStopped();
    await this.ipcClient.disconnect();
    await this.appClient.close();
  }

  public async listProjectDirectories(): Promise<string[]> {
    return [this.workspaceDir];
  }

  public async listThreads(input: AgentListThreadsInput): Promise<AgentListThreadsResult> {
    return this.threadManagementOwner.listThreads(input);
  }

  public async createThread(input: AgentCreateThreadInput): Promise<AgentCreateThreadResult> {
    return this.threadManagementOwner.createThread(input);
  }

  public async readThread(input: AgentReadThreadInput): Promise<AgentReadThreadResult> {
    return this.threadManagementOwner.readThread(input);
  }

  public async sendMessage(input: AgentSendMessageInput): Promise<void> {
    this.ensureCodexAvailable();
    if (input.isSteering === true) {
      throw new Error(STEERING_UNSUPPORTED_ENDPOINT_ERROR);
    }
    await this.messageDispatchOwner.sendMessage(input, this.isIpcReady());
  }

  public async interrupt(input: AgentInterruptInput): Promise<void> {
    await this.threadInteractionOwner.interrupt(input);
  }

  public async archiveThread(input: { threadId: string }): Promise<void> {
    await this.threadManagementOwner.archiveThread(input);
  }

  public async unarchiveThread(input: { threadId: string }): Promise<void> {
    await this.threadManagementOwner.unarchiveThread(input);
  }

  public async listModels(limit: number): Promise<AppServerListModelsResponse> {
    return this.threadManagementOwner.listModels(limit);
  }

  public async listCollaborationModes(): Promise<AppServerCollaborationModeListResponse> {
    return this.threadManagementOwner.listCollaborationModes();
  }

  public async readConfigDefaults(): Promise<AgentConfigDefaults> {
    return this.threadManagementOwner.readConfigDefaults();
  }

  public async setCollaborationMode(
    input: AgentSetCollaborationModeInput,
  ): Promise<{ ownerClientId: string }> {
    return this.threadInteractionOwner.setCollaborationMode(input);
  }

  public async submitUserInput(
    input: AgentSubmitUserInputInput,
  ): Promise<{ ownerClientId: string; requestId: number }> {
    return this.threadInteractionOwner.submitUserInput(input);
  }

  public async readLiveState(threadId: string): Promise<AgentThreadLiveState> {
    return this.threadInteractionOwner.readLiveState(threadId);
  }

  public async readStreamEvents(
    threadId: string,
    input: AgentReadStreamEventsInput,
  ): Promise<AgentThreadStreamEvents> {
    return this.threadInteractionOwner.readStreamEvents(threadId, input);
  }

  public async replayRequest(
    method: string,
    params: IpcRequestFrame["params"],
    options: SendRequestOptions = {},
  ): Promise<IpcResponseFrame["result"]> {
    return this.threadInteractionOwner.replayRequest(method, params, options);
  }

  public replayBroadcast(
    method: string,
    params: IpcRequestFrame["params"],
    options: SendRequestOptions = {},
  ): void {
    this.threadInteractionOwner.replayBroadcast(method, params, options);
  }

  private emitIpcFrame(event: CodexIpcFrameEvent): void {
    for (const listener of this.ipcFrameListeners) {
      listener(event);
    }
  }

  private ensureCodexAvailable(): void {
    this.connectionLifecycleOwner.ensureCodexAvailable();
  }

  private ensureIpcReady(): void {
    this.connectionLifecycleOwner.ensureIpcReady();
  }
}

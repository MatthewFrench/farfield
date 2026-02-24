import {
  AppServerClient,
  AppServerRpcError,
  CodexMonitorService,
  DesktopIpcClient,
  type SendRequestOptions
} from "@farfield/api";
import {
  JsonValueSchema,
  parseUserInputResponsePayload,
  type IpcFrame,
  type IpcRequestFrame,
  type IpcResponseFrame
} from "@farfield/protocol";
import type {
  AgentAdapter,
  AgentArchiveThreadInput,
  AgentConfigDefaults,
  AgentCapabilities,
  AgentCreateThreadInput,
  AgentCreateThreadResult,
  AgentInterruptInput,
  AgentListThreadsInput,
  AgentListThreadsResult,
  AgentReadThreadInput,
  AgentReadThreadResult,
  AgentSendMessageInput,
  AgentSetCollaborationModeInput,
  AgentSubmitUserInputInput,
  AgentUnarchiveThreadInput,
  AgentThreadLiveState,
  AgentThreadStreamEvents
} from "../Types.js";
import { CodexAppServerStderrOwner } from "./CodexAppServerStderrOwner.js";
import { CodexConnectionLifecycleOwner } from "./CodexConnectionLifecycleOwner.js";
import { CodexMessageDispatchOwner } from "./CodexMessageDispatchOwner.js";
import { CodexThreadStreamStateOwner } from "./CodexThreadStreamStateOwner.js";

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

export interface CodexAgentOptions {
  appExecutable: string;
  socketPath: string;
  workspaceDir: string;
  userAgent: string;
  reconnectDelayMs: number;
  onStateChange?: () => void;
}

export class CodexAgentAdapter implements AgentAdapter {
  public readonly id = "codex";
  public readonly label = "Codex";
  public readonly capabilities: AgentCapabilities = {
    canListModels: true,
    canListCollaborationModes: true,
    canSetCollaborationMode: true,
    canSubmitUserInput: true,
    canReadLiveState: true,
    canReadStreamEvents: true
  };

  private readonly appClient: AppServerClient;
  private readonly ipcClient: DesktopIpcClient;
  private readonly service: CodexMonitorService;
  private readonly appServerStderrOwner: CodexAppServerStderrOwner;
  private readonly threadStreamStateOwner: CodexThreadStreamStateOwner;
  private readonly connectionLifecycleOwner: CodexConnectionLifecycleOwner;
  private readonly messageDispatchOwner: CodexMessageDispatchOwner;
  private readonly workspaceDir: string;

  private readonly ipcFrameListeners = new Set<(event: CodexIpcFrameEvent) => void>();

  public constructor(options: CodexAgentOptions) {
    this.workspaceDir = options.workspaceDir;
    this.appServerStderrOwner = new CodexAppServerStderrOwner();
    this.threadStreamStateOwner = new CodexThreadStreamStateOwner();

    this.appClient = new AppServerClient({
      executablePath: options.appExecutable,
      userAgent: options.userAgent,
      cwd: options.workspaceDir,
      onStderr: (line) => {
        this.appServerStderrOwner.handleStderrLine(line);
      }
    });

    this.ipcClient = new DesktopIpcClient({
      socketPath: options.socketPath
    });
    this.service = new CodexMonitorService(this.ipcClient);
    this.connectionLifecycleOwner = new CodexConnectionLifecycleOwner({
      appClient: this.appClient,
      ipcClient: this.ipcClient,
      label: this.label,
      reconnectDelayMs: options.reconnectDelayMs,
      onStateChange: options.onStateChange ?? null
    });
    this.messageDispatchOwner = new CodexMessageDispatchOwner({
      appClient: this.appClient,
      service: this.service,
      threadStreamStateOwner: this.threadStreamStateOwner,
      runAppServerCall: async <ValueType,>(operation: () => Promise<ValueType>): Promise<ValueType> => {
        return this.connectionLifecycleOwner.runAppServerCall(operation);
      },
      isConversationNotFoundError: <ErrorType,>(error: ErrorType): boolean => {
        return this.isConversationNotFoundError(error);
      }
    });

    this.ipcClient.onConnectionState((state) => {
      this.connectionLifecycleOwner.handleIpcConnectionState(state);
    });

    this.ipcClient.onFrame((frame) => {
      const frameDescription = this.threadStreamStateOwner.describeFrame(frame);

      this.emitIpcFrame({
        direction: "in",
        frame,
        method: frameDescription.method,
        threadId: frameDescription.threadId
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
    if (!(error instanceof AppServerRpcError)) {
      return false;
    }

    if (error.code !== -32600) {
      return false;
    }

    return error.message.includes("thread not loaded");
  }

  public isConversationNotFoundError<ErrorType>(error: ErrorType): boolean {
    if (!(error instanceof AppServerRpcError)) {
      return false;
    }

    if (error.code !== -32600) {
      return false;
    }

    return error.message.includes("conversation not found");
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
    this.ensureCodexAvailable();

    const result = await this.runAppServerCall(() =>
      input.all
        ? this.appClient.listThreadsAll(
            input.cursor
              ? {
              limit: input.limit,
              archived: input.archived,
              cursor: input.cursor,
              sortKey: input.sortKey,
              ...(input.cwd ? { cwd: input.cwd } : {}),
              maxPages: input.maxPages
            }
          : {
              limit: input.limit,
              archived: input.archived,
              sortKey: input.sortKey,
              ...(input.cwd ? { cwd: input.cwd } : {}),
              maxPages: input.maxPages
            }
          )
        : this.appClient.listThreads(
            input.cursor
              ? {
                  limit: input.limit,
                  archived: input.archived,
                  cursor: input.cursor,
                  sortKey: input.sortKey,
                  ...(input.cwd ? { cwd: input.cwd } : {})
                }
              : {
                  limit: input.limit,
                  archived: input.archived,
                  sortKey: input.sortKey,
                  ...(input.cwd ? { cwd: input.cwd } : {})
                }
          )
    );

    return {
      data: result.data,
      nextCursor: result.nextCursor ?? null,
      ...(typeof result.pages === "number" ? { pages: result.pages } : {}),
      ...(typeof result.truncated === "boolean" ? { truncated: result.truncated } : {})
    };
  }

  public async createThread(input: AgentCreateThreadInput): Promise<AgentCreateThreadResult> {
    this.ensureCodexAvailable();

    const cwd = input.cwd;
    if (!cwd || cwd.trim().length === 0) {
      throw new Error("Codex thread creation requires cwd");
    }

    const result = await this.runAppServerCall(() =>
      this.appClient.startThread({
        cwd,
        ...(input.model ? { model: input.model } : {}),
        ...(input.modelProvider ? { modelProvider: input.modelProvider } : {}),
        ...(input.personality ? { personality: input.personality } : {}),
        ...(input.sandbox ? { sandbox: input.sandbox } : {}),
        ...(input.approvalPolicy ? { approvalPolicy: input.approvalPolicy } : {}),
        ...(typeof input.ephemeral === "boolean" ? { ephemeral: input.ephemeral } : {})
      })
    );

    return {
      threadId: result.thread.id,
      thread: result.thread,
      model: result.model,
      modelProvider: result.modelProvider,
      cwd: result.cwd,
      approvalPolicy: result.approvalPolicy,
      sandbox: result.sandbox,
      reasoningEffort: result.reasoningEffort
    };
  }

  public async readThread(input: AgentReadThreadInput): Promise<AgentReadThreadResult> {
    this.ensureCodexAvailable();
    const result = await this.runAppServerCall(() =>
      this.appClient.readThread(input.threadId, input.includeTurns)
    );
    return {
      thread: result.thread
    };
  }

  public async sendMessage(input: AgentSendMessageInput): Promise<void> {
    this.ensureCodexAvailable();
    if (input.isSteering === true) {
      throw new Error("Steering messages are not supported on this endpoint.");
    }
    await this.messageDispatchOwner.sendMessage(input, this.isIpcReady());
  }

  public async interrupt(input: AgentInterruptInput): Promise<void> {
    this.ensureCodexAvailable();
    this.ensureIpcReady();

    const ownerClientId = this.threadStreamStateOwner.resolveRequiredOwnerClientId(
      input.threadId,
      input.ownerClientId
    );

    await this.service.interrupt({
      threadId: input.threadId,
      ownerClientId
    });
  }

  public async archiveThread(input: AgentArchiveThreadInput): Promise<void> {
    this.ensureCodexAvailable();
    await this.runAppServerCall(() => this.appClient.archiveThread(input.threadId));
  }

  public async unarchiveThread(input: AgentUnarchiveThreadInput): Promise<void> {
    this.ensureCodexAvailable();
    await this.runAppServerCall(() => this.appClient.unarchiveThread(input.threadId));
  }

  public async listModels(limit: number) {
    this.ensureCodexAvailable();
    return this.runAppServerCall(() => this.appClient.listModels(limit));
  }

  public async listCollaborationModes() {
    this.ensureCodexAvailable();
    return this.runAppServerCall(() => this.appClient.listCollaborationModes());
  }

  public async readConfigDefaults(): Promise<AgentConfigDefaults> {
    this.ensureCodexAvailable();
    const config = await this.runAppServerCall(() =>
      this.appClient.readConfig({ includeLayers: false })
    );

    const activeProfileName = config.config.profile;
    const activeProfile = activeProfileName ? config.config.profiles[activeProfileName] : undefined;

    return {
      model: activeProfile?.model ?? config.config.model ?? null,
      reasoningEffort:
        activeProfile?.model_reasoning_effort ?? config.config.model_reasoning_effort ?? null
    };
  }

  public async setCollaborationMode(input: AgentSetCollaborationModeInput): Promise<{ ownerClientId: string }> {
    this.ensureCodexAvailable();
    this.ensureIpcReady();

    const ownerClientId = this.threadStreamStateOwner.resolveRequiredOwnerClientId(
      input.threadId,
      input.ownerClientId
    );

    await this.service.setCollaborationMode({
      threadId: input.threadId,
      ownerClientId,
      collaborationMode: input.collaborationMode
    });

    return {
      ownerClientId
    };
  }

  public async submitUserInput(
    input: AgentSubmitUserInputInput
  ): Promise<{ ownerClientId: string; requestId: number }> {
    this.ensureCodexAvailable();
    this.ensureIpcReady();

    const ownerClientId = this.threadStreamStateOwner.resolveRequiredOwnerClientId(
      input.threadId,
      input.ownerClientId
    );

    await this.service.submitUserInput({
      threadId: input.threadId,
      ownerClientId,
      requestId: input.requestId,
      response: parseUserInputResponsePayload(JsonValueSchema.parse(input.response))
    });

    return {
      ownerClientId,
      requestId: input.requestId
    };
  }

  public async readLiveState(threadId: string): Promise<AgentThreadLiveState> {
    return this.threadStreamStateOwner.readLiveState(threadId);
  }

  public async readStreamEvents(threadId: string, limit: number): Promise<AgentThreadStreamEvents> {
    return this.threadStreamStateOwner.readStreamEvents(threadId, limit);
  }

  public async replayRequest(
    method: string,
    params: IpcRequestFrame["params"],
    options: SendRequestOptions = {}
  ): Promise<IpcResponseFrame["result"]> {
    this.ensureIpcReady();
    const previewFrame: IpcFrame = {
      type: "request",
      requestId: "monitor-preview-request-id",
      method,
      params,
      targetClientId: options.targetClientId,
      version: options.version
    };
    const previewFrameDescription = this.threadStreamStateOwner.describeFrame(previewFrame);
    this.emitIpcFrame({
      direction: "out",
      frame: previewFrame,
      method,
      threadId: previewFrameDescription.threadId
    });

    const response = await this.ipcClient.sendRequestAndWait(method, params, options);
    return response.result;
  }

  public replayBroadcast(
    method: string,
    params: IpcRequestFrame["params"],
    options: SendRequestOptions = {}
  ): void {
    this.ensureIpcReady();
    const previewFrame: IpcFrame = {
      type: "broadcast",
      method,
      params,
      targetClientId: options.targetClientId,
      version: options.version
    };
    const previewRequestFrame: IpcFrame = {
      type: "request",
      requestId: "monitor-preview-request-id",
      method,
      params,
      targetClientId: options.targetClientId,
      version: options.version
    };
    const previewRequestDescription = this.threadStreamStateOwner.describeFrame(previewRequestFrame);
    this.emitIpcFrame({
      direction: "out",
      frame: previewFrame,
      method,
      threadId: previewRequestDescription.threadId
    });

    this.ipcClient.sendBroadcast(method, params, options);
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

  private async runAppServerCall<T>(operation: () => Promise<T>): Promise<T> {
    return this.connectionLifecycleOwner.runAppServerCall(operation);
  }
}

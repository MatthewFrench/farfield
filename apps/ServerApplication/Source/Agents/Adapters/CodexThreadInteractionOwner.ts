import {
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
  AgentInterruptInput,
  AgentSetCollaborationModeInput,
  AgentSubmitUserInputInput,
  AgentThreadLiveState,
  AgentThreadStreamEvents
} from "../Types.js";
import {
  type CodexIpcFrameEvent
} from "./CodexAgentAdapter.js";
import type { CodexThreadStreamStateOwner } from "./CodexThreadStreamStateOwner.js";

export interface CodexThreadInteractionOwnerOptions {
  service: CodexMonitorService;
  ipcClient: DesktopIpcClient;
  threadStreamStateOwner: CodexThreadStreamStateOwner;
  ensureCodexAvailable: () => void;
  ensureIpcReady: () => void;
  emitIpcFrame: (event: CodexIpcFrameEvent) => void;
}

export class CodexThreadInteractionOwner {
  private readonly service: CodexMonitorService;
  private readonly ipcClient: DesktopIpcClient;
  private readonly threadStreamStateOwner: CodexThreadStreamStateOwner;
  private readonly ensureCodexAvailable: () => void;
  private readonly ensureIpcReady: () => void;
  private readonly emitIpcFrame: (event: CodexIpcFrameEvent) => void;

  public constructor(options: CodexThreadInteractionOwnerOptions) {
    this.service = options.service;
    this.ipcClient = options.ipcClient;
    this.threadStreamStateOwner = options.threadStreamStateOwner;
    this.ensureCodexAvailable = options.ensureCodexAvailable;
    this.ensureIpcReady = options.ensureIpcReady;
    this.emitIpcFrame = options.emitIpcFrame;
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

  public async setCollaborationMode(
    input: AgentSetCollaborationModeInput
  ): Promise<{ ownerClientId: string }> {
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
}

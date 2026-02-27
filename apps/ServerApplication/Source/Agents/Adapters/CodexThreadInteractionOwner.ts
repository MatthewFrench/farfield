import { CodexMonitorService, DesktopIpcClient, type SendRequestOptions } from "@farfield/api";
import {
  type IpcFrame,
  type IpcRequestFrame,
  type IpcResponseFrame,
  JsonValueSchema,
  parseUserInputResponsePayload,
} from "@farfield/protocol";
import type {
  AgentInterruptInput,
  AgentReadStreamEventsInput,
  AgentSetCollaborationModeInput,
  AgentSubmitUserInputInput,
  AgentThreadLiveState,
  AgentThreadStreamEvents,
} from "../Types.js";
import { type CodexIpcFrameEvent } from "./CodexAgentAdapter.js";
import type { CodexThreadStreamStateOwner } from "./CodexThreadStreamStateOwner.js";

const MONITOR_PREVIEW_REQUEST_IDENTIFIER = "monitor-preview-request-id";
const OUTBOUND_IPC_FRAME_DIRECTION: CodexIpcFrameEvent["direction"] = "out";

type IpcRequestParameters = IpcRequestFrame["params"];

function createPreviewRequestFrame(
  method: string,
  params: IpcRequestParameters,
  options: SendRequestOptions,
): IpcRequestFrame {
  return {
    type: "request",
    requestId: MONITOR_PREVIEW_REQUEST_IDENTIFIER,
    method,
    params,
    targetClientId: options.targetClientId,
    version: options.version,
  };
}

function createPreviewBroadcastFrame(
  method: string,
  params: IpcRequestParameters,
  options: SendRequestOptions,
): IpcFrame {
  return {
    type: "broadcast",
    method,
    params,
    targetClientId: options.targetClientId,
    version: options.version,
  };
}

export interface CodexThreadInteractionOwnerOptions {
  service: CodexMonitorService;
  ipcClient: DesktopIpcClient;
  threadStreamStateOwner: CodexThreadStreamStateOwner;
  ensureCodexAvailable: () => void;
  ensureIpcReady: () => void;
  emitIpcFrame: (event: CodexIpcFrameEvent) => void;
}

/**
 * Owns thread interaction command orchestration that requires a resolved owner client.
 * Outbound replay previews are emitted through this owner before IPC transport calls complete.
 */
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
    this.ensureInteractionReady();
    const ownerClientId = this.resolveRequiredOwnerClientId(input.threadId, input.ownerClientId);

    await this.service.interrupt({
      threadId: input.threadId,
      ownerClientId,
    });
  }

  public async setCollaborationMode(
    input: AgentSetCollaborationModeInput,
  ): Promise<{ ownerClientId: string }> {
    this.ensureInteractionReady();
    const ownerClientId = this.resolveRequiredOwnerClientId(input.threadId, input.ownerClientId);

    await this.service.setCollaborationMode({
      threadId: input.threadId,
      ownerClientId,
      collaborationMode: input.collaborationMode,
    });

    return {
      ownerClientId,
    };
  }

  public async submitUserInput(
    input: AgentSubmitUserInputInput,
  ): Promise<{ ownerClientId: string; requestId: number }> {
    this.ensureInteractionReady();
    const ownerClientId = this.resolveRequiredOwnerClientId(input.threadId, input.ownerClientId);

    await this.service.submitUserInput({
      threadId: input.threadId,
      ownerClientId,
      requestId: input.requestId,
      response: parseUserInputResponsePayload(JsonValueSchema.parse(input.response)),
    });

    return {
      ownerClientId,
      requestId: input.requestId,
    };
  }

  public async readLiveState(threadId: string): Promise<AgentThreadLiveState> {
    return this.threadStreamStateOwner.readLiveState(threadId);
  }

  public async readStreamEvents(
    threadId: string,
    input: AgentReadStreamEventsInput,
  ): Promise<AgentThreadStreamEvents> {
    return this.threadStreamStateOwner.readStreamEvents(threadId, input);
  }

  public async replayRequest(
    method: string,
    params: IpcRequestParameters,
    options: SendRequestOptions = {},
  ): Promise<IpcResponseFrame["result"]> {
    this.ensureIpcReady();
    const previewFrame = createPreviewRequestFrame(method, params, options);
    this.emitOutboundPreviewFrame(method, previewFrame, previewFrame);

    const response = await this.ipcClient.sendRequestAndWait(method, params, options);
    return response.result;
  }

  public replayBroadcast(
    method: string,
    params: IpcRequestParameters,
    options: SendRequestOptions = {},
  ): void {
    this.ensureIpcReady();
    const previewFrame = createPreviewBroadcastFrame(method, params, options);
    const previewRequestFrame = createPreviewRequestFrame(method, params, options);
    // Request-shape preview is used for thread-id extraction because describeFrame
    // intentionally reports thread identifiers only for request frames on most methods.
    this.emitOutboundPreviewFrame(method, previewFrame, previewRequestFrame);

    this.ipcClient.sendBroadcast(method, params, options);
  }

  private ensureInteractionReady(): void {
    this.ensureCodexAvailable();
    this.ensureIpcReady();
  }

  private resolveRequiredOwnerClientId(
    threadId: string,
    ownerClientId: string | undefined,
  ): string {
    return this.threadStreamStateOwner.resolveRequiredOwnerClientId(threadId, ownerClientId);
  }

  private emitOutboundPreviewFrame(
    method: string,
    frame: IpcFrame,
    descriptionFrame: IpcFrame,
  ): void {
    const frameDescription = this.threadStreamStateOwner.describeFrame(descriptionFrame);
    this.emitIpcFrame({
      direction: OUTBOUND_IPC_FRAME_DIRECTION,
      frame,
      method,
      threadId: frameDescription.threadId,
    });
  }
}

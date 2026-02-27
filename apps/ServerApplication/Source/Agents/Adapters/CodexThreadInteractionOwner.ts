import {
  AppServerClient,
  CodexMonitorService,
  DesktopIpcClient,
  type SendRequestOptions,
} from "@farfield/api";
import {
  type IpcFrame,
  type IpcRequestFrame,
  type IpcResponseFrame,
  type JsonValue,
  JsonValueSchema,
  parseIpcFrame,
  parseThreadConversationRequestResponse,
  UserInputRequestMethod,
} from "@farfield/protocol";
import { z } from "zod";
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
const APP_SERVER_OWNER_CLIENT_IDENTIFIER = "app-server";
const APP_SERVER_NOTIFICATION_EVENT_METHOD = "app-server-notification";
const APP_SERVER_NOTIFICATION_ENVELOPE_VERSION = 1;
const AppServerNotificationThreadIdentifierSchema = z
  .object({
    threadId: z.string().min(1),
  })
  .passthrough();

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
  appClient: AppServerClient;
  service: CodexMonitorService;
  ipcClient: DesktopIpcClient;
  threadStreamStateOwner: CodexThreadStreamStateOwner;
  ensureCodexAvailable: () => void;
  ensureIpcReady: () => void;
  isIpcReady: () => boolean;
  emitIpcFrame: (event: CodexIpcFrameEvent) => void;
}

/**
 * Owns thread interaction command orchestration that requires a resolved owner client.
 * Outbound replay previews are emitted through this owner before IPC transport calls complete.
 */
export class CodexThreadInteractionOwner {
  private readonly appClient: AppServerClient;
  private readonly service: CodexMonitorService;
  private readonly ipcClient: DesktopIpcClient;
  private readonly threadStreamStateOwner: CodexThreadStreamStateOwner;
  private readonly ensureCodexAvailable: () => void;
  private readonly ensureIpcReady: () => void;
  private readonly isIpcReady: () => boolean;
  private readonly emitIpcFrame: (event: CodexIpcFrameEvent) => void;

  public constructor(options: CodexThreadInteractionOwnerOptions) {
    this.appClient = options.appClient;
    this.service = options.service;
    this.ipcClient = options.ipcClient;
    this.threadStreamStateOwner = options.threadStreamStateOwner;
    this.ensureCodexAvailable = options.ensureCodexAvailable;
    this.ensureIpcReady = options.ensureIpcReady;
    this.isIpcReady = options.isIpcReady;
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
    const parsedResponse = parseThreadConversationRequestResponse(
      JsonValueSchema.parse(input.response),
    );

    if (this.isIpcReady()) {
      if (parsedResponse.method !== UserInputRequestMethod) {
        throw new Error(`IPC submit-user-input only supports ${UserInputRequestMethod} responses.`);
      }

      this.ensureInteractionReady();
      const ownerClientId = this.resolveRequiredOwnerClientId(input.threadId, input.ownerClientId);

      await this.service.submitUserInput({
        threadId: input.threadId,
        ownerClientId,
        requestId: input.requestId,
        response: parsedResponse.payload,
      });

      return {
        ownerClientId,
        requestId: input.requestId,
      };
    }

    this.ensureCodexAvailable();
    await this.appClient.submitServerRequestResponse(input.requestId, parsedResponse);

    return {
      ownerClientId: APP_SERVER_OWNER_CLIENT_IDENTIFIER,
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
    if (!this.isIpcReady()) {
      const notificationBatch = this.appClient.readNotificationEvents({
        limit: input.limit,
        sinceSequence: input.sinceSequence,
      });

      return {
        ownerClientId: APP_SERVER_OWNER_CLIENT_IDENTIFIER,
        events: notificationBatch.events
          .filter((event) => resolveAppServerEventThreadId(event.params) === threadId)
          .map((event) =>
            parseIpcFrame({
              type: "broadcast",
              method: APP_SERVER_NOTIFICATION_EVENT_METHOD,
              sourceClientId: APP_SERVER_OWNER_CLIENT_IDENTIFIER,
              version: APP_SERVER_NOTIFICATION_ENVELOPE_VERSION,
              params: {
                method: event.method,
                sequence: event.sequence,
                receivedAtMilliseconds: event.receivedAtMilliseconds,
                payload: event.params,
              },
            }),
          ),
        nextSequence: notificationBatch.nextSequence,
        firstAvailableSequence: notificationBatch.firstAvailableSequence,
        resetRequired: notificationBatch.resetRequired,
      };
    }

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

function resolveAppServerEventThreadId(params: JsonValue | null): string | null {
  if (params === null) {
    return null;
  }

  const parsedThreadIdentifier = AppServerNotificationThreadIdentifierSchema.safeParse(params);
  if (!parsedThreadIdentifier.success) {
    return null;
  }

  return parsedThreadIdentifier.data.threadId;
}

import {
  JsonValueSchema,
  type JsonValue,
  type IpcResponseFrame,
  type TurnStartParams,
  type CollaborationMode,
  parseUserInputResponsePayload,
  type UserInputResponsePayload
} from "@farfield/protocol";
const THREAD_FOLLOWER_START_TURN_METHOD = "thread-follower-start-turn";
const THREAD_FOLLOWER_SET_COLLABORATION_MODE_METHOD = "thread-follower-set-collaboration-mode";
const THREAD_FOLLOWER_SUBMIT_USER_INPUT_METHOD = "thread-follower-submit-user-input";
const THREAD_FOLLOWER_INTERRUPT_TURN_METHOD = "thread-follower-interrupt-turn";
const THREAD_FOLLOWER_PROTOCOL_VERSION = 1;

/**
 * Normalizes optional and class-backed values into strict structured data.
 * JSON round-tripping intentionally removes `undefined` so payloads match transport contracts.
 */
function normalizeStructuredDataValue(value: object): JsonValue {
  const serialized = JSON.stringify(value);
  const parsed = JSON.parse(serialized);
  return JsonValueSchema.parse(parsed);
}

export interface ThreadFollowerRequestOptions {
  targetClientId: string;
  version: number;
}

export interface CodexMonitorIpcClient {
  sendRequestAndWait(
    method: string,
    params: JsonValue,
    options: ThreadFollowerRequestOptions
  ): Promise<IpcResponseFrame>;
}

function buildThreadFollowerRequestOptions(ownerClientId: string): ThreadFollowerRequestOptions {
  return {
    targetClientId: ownerClientId,
    version: THREAD_FOLLOWER_PROTOCOL_VERSION
  };
}

export interface SendMessageInput {
  threadId: string;
  ownerClientId: string;
  text: string;
  cwd?: string;
  isSteering?: boolean;
  turnStartTemplate?: TurnStartParams | null;
  model?: string | null;
  effort?: string | null;
  collaborationMode?: CollaborationMode | null;
}

export interface SetModeInput {
  threadId: string;
  ownerClientId: string;
  collaborationMode: CollaborationMode;
}

export interface SubmitUserInputInput {
  threadId: string;
  ownerClientId: string;
  requestId: number;
  response: UserInputResponsePayload;
}

export interface InterruptInput {
  threadId: string;
  ownerClientId: string;
}

/**
 * Owns Codex thread-level command payload construction over desktop IPC.
 * IPC transport delivery remains in the owned IPC client implementation.
 */
export class CodexMonitorService {
  private readonly ipcClient: CodexMonitorIpcClient;

  public constructor(ipcClient: CodexMonitorIpcClient) {
    this.ipcClient = ipcClient;
  }

  public async sendMessage(input: SendMessageInput): Promise<void> {
    const text = input.text.trim();
    if (!text) {
      throw new Error("Message text is required");
    }

    const template = input.turnStartTemplate;

    const turnStartParams: TurnStartParams = template
      ? {
          ...template,
          threadId: input.threadId,
          input: [{ type: "text" as const, text }],
          cwd: input.cwd ?? template.cwd,
          attachments: Array.isArray(template.attachments) ? template.attachments : []
        }
      : {
          threadId: input.threadId,
          input: [{ type: "text" as const, text }],
          ...(input.cwd ? { cwd: input.cwd } : {}),
          attachments: []
        };

    if (Object.prototype.hasOwnProperty.call(input, "model")) {
      turnStartParams.model = input.model ?? null;
    }

    if (Object.prototype.hasOwnProperty.call(input, "effort")) {
      turnStartParams.effort = input.effort ?? null;
    }

    if (Object.prototype.hasOwnProperty.call(input, "collaborationMode")) {
      turnStartParams.collaborationMode = input.collaborationMode ?? null;
    }

    const requestParams = normalizeStructuredDataValue({
      conversationId: input.threadId,
      turnStartParams,
      isSteering: Boolean(input.isSteering)
    });

    await this.ipcClient.sendRequestAndWait(
      THREAD_FOLLOWER_START_TURN_METHOD,
      requestParams,
      buildThreadFollowerRequestOptions(input.ownerClientId)
    );
  }

  public async setCollaborationMode(input: SetModeInput): Promise<void> {
    const requestParams = normalizeStructuredDataValue({
      conversationId: input.threadId,
      collaborationMode: input.collaborationMode
    });

    await this.ipcClient.sendRequestAndWait(
      THREAD_FOLLOWER_SET_COLLABORATION_MODE_METHOD,
      requestParams,
      buildThreadFollowerRequestOptions(input.ownerClientId)
    );
  }

  public async submitUserInput(input: SubmitUserInputInput): Promise<void> {
    const responsePayload = parseUserInputResponsePayload(
      normalizeStructuredDataValue(input.response)
    );

    const requestParams = normalizeStructuredDataValue({
      conversationId: input.threadId,
      requestId: input.requestId,
      response: responsePayload
    });

    await this.ipcClient.sendRequestAndWait(
      THREAD_FOLLOWER_SUBMIT_USER_INPUT_METHOD,
      requestParams,
      buildThreadFollowerRequestOptions(input.ownerClientId)
    );
  }

  public async interrupt(input: InterruptInput): Promise<void> {
    const requestParams = normalizeStructuredDataValue({
      conversationId: input.threadId
    });

    await this.ipcClient.sendRequestAndWait(
      THREAD_FOLLOWER_INTERRUPT_TURN_METHOD,
      requestParams,
      buildThreadFollowerRequestOptions(input.ownerClientId)
    );
  }
}

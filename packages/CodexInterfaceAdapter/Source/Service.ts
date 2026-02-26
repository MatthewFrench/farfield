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
const MESSAGE_TEXT_REQUIRED_ERROR_MESSAGE = "Message text is required";
const TURN_START_TEXT_INPUT_PART_TYPE = "text" as const;

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

interface ThreadFollowerStartTurnRequestParameters {
  conversationId: string;
  turnStartParams: TurnStartParams;
  isSteering: boolean;
}

interface ThreadFollowerSetCollaborationModeRequestParameters {
  conversationId: string;
  collaborationMode: CollaborationMode;
}

interface ThreadFollowerSubmitUserInputRequestParameters {
  conversationId: string;
  requestId: number;
  response: UserInputResponsePayload;
}

interface ThreadFollowerInterruptRequestParameters {
  conversationId: string;
}

type ThreadFollowerRequestParameters =
  | ThreadFollowerStartTurnRequestParameters
  | ThreadFollowerSetCollaborationModeRequestParameters
  | ThreadFollowerSubmitUserInputRequestParameters
  | ThreadFollowerInterruptRequestParameters;

function buildTurnStartParams(input: SendMessageInput, trimmedText: string): TurnStartParams {
  const textInput = [{ type: TURN_START_TEXT_INPUT_PART_TYPE, text: trimmedText }];
  const template = input.turnStartTemplate;
  const turnStartParams: TurnStartParams = template
    ? {
        ...template,
        threadId: input.threadId,
        input: textInput,
        cwd: input.cwd ?? template.cwd,
        attachments: template.attachments ?? []
      }
    : {
        threadId: input.threadId,
        input: textInput,
        ...(input.cwd !== undefined ? { cwd: input.cwd } : {}),
        attachments: []
      };

  applyTurnStartOverrides(turnStartParams, input);

  return turnStartParams;
}

/**
 * Optional overrides are applied only when provided by the typed service API.
 * Omitted fields intentionally preserve template values.
 */
function applyTurnStartOverrides(turnStartParams: TurnStartParams, input: SendMessageInput): void {
  if (input.model !== undefined) {
    turnStartParams.model = input.model;
  }

  if (input.effort !== undefined) {
    turnStartParams.effort = input.effort;
  }

  if (input.collaborationMode !== undefined) {
    turnStartParams.collaborationMode = input.collaborationMode;
  }
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
    const trimmedText = input.text.trim();
    if (!trimmedText) {
      throw new Error(MESSAGE_TEXT_REQUIRED_ERROR_MESSAGE);
    }

    const requestParameters: ThreadFollowerStartTurnRequestParameters = {
      conversationId: input.threadId,
      turnStartParams: buildTurnStartParams(input, trimmedText),
      isSteering: Boolean(input.isSteering)
    };

    await this.sendThreadFollowerRequest(
      THREAD_FOLLOWER_START_TURN_METHOD,
      requestParameters,
      input.ownerClientId
    );
  }

  public async setCollaborationMode(input: SetModeInput): Promise<void> {
    const requestParameters: ThreadFollowerSetCollaborationModeRequestParameters = {
      conversationId: input.threadId,
      collaborationMode: input.collaborationMode
    };

    await this.sendThreadFollowerRequest(
      THREAD_FOLLOWER_SET_COLLABORATION_MODE_METHOD,
      requestParameters,
      input.ownerClientId
    );
  }

  public async submitUserInput(input: SubmitUserInputInput): Promise<void> {
    const responsePayload = parseUserInputResponsePayload(
      normalizeStructuredDataValue(input.response)
    );

    const requestParameters: ThreadFollowerSubmitUserInputRequestParameters = {
      conversationId: input.threadId,
      requestId: input.requestId,
      response: responsePayload
    };

    await this.sendThreadFollowerRequest(
      THREAD_FOLLOWER_SUBMIT_USER_INPUT_METHOD,
      requestParameters,
      input.ownerClientId
    );
  }

  public async interrupt(input: InterruptInput): Promise<void> {
    const requestParameters: ThreadFollowerInterruptRequestParameters = {
      conversationId: input.threadId
    };

    await this.sendThreadFollowerRequest(
      THREAD_FOLLOWER_INTERRUPT_TURN_METHOD,
      requestParameters,
      input.ownerClientId
    );
  }

  private async sendThreadFollowerRequest(
    method: string,
    requestParameters: ThreadFollowerRequestParameters,
    ownerClientId: string
  ): Promise<void> {
    const requestParams = normalizeStructuredDataValue(requestParameters);
    await this.ipcClient.sendRequestAndWait(
      method,
      requestParams,
      buildThreadFollowerRequestOptions(ownerClientId)
    );
  }
}

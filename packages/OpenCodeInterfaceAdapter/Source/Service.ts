import { z } from "zod";
import type {
  OpenCodeConnectionClientProvider,
  OpenCodeDirectoryQuery,
  OpenCodeSessionCreateRequest,
  OpenCodeSessionListRequest,
  OpenCodeSessionPromptBody,
  OpenCodeSessionPromptRequest,
  OpenCodeSessionReadRequest
} from "./ClientContracts.js";
import {
  sessionToConversationState,
  sessionToThreadListItem
} from "./SessionMapper.js";
import type {
  MappedThreadConversationState,
  MappedThreadListItem
} from "./MapperContracts.js";
import {
  OpenCodeStructuredDataValueSchema,
  parseOpenCodeProjectList,
  parseOpenCodeSession,
  parseOpenCodeSessionList,
  parseOpenCodeSessionMessages,
  type OpenCodeMessage,
  type OpenCodePart,
  type OpenCodeSessionMessageEntry,
  type OpenCodeSession,
  type OpenCodeStructuredDataValue
} from "./Schemas.js";

export interface OpenCodeSendMessageInput {
  sessionId: string;
  text: string;
  directory?: string;
}

export interface OpenCodeCreateSessionInput {
  title?: string;
  directory?: string;
}

const OPEN_CODE_MESSAGE_TEXT_REQUIRED_ERROR = "Message text is required";
const OPEN_CODE_PROMPT_TEXT_PART_TYPE = "text";
const OPEN_CODE_EMPTY_COLLECTION_VALUE: OpenCodeStructuredDataValue = [];
const OpenCodeSessionIdentifierSchema = z.string().trim().min(1);
const OpenCodeDirectorySchema = z.string().trim().min(1);
const OpenCodeListSessionsInputSchema = z
  .object({
    directory: OpenCodeDirectorySchema.optional()
  })
  .strict();
const OpenCodeCreateSessionInputSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    directory: OpenCodeDirectorySchema.optional()
  })
  .strict();
const OpenCodeSessionLookupInputSchema = z
  .object({
    sessionId: OpenCodeSessionIdentifierSchema,
    directory: OpenCodeDirectorySchema.optional()
  })
  .strict();
const OpenCodeSendMessageInputSchema = z
  .object({
    sessionId: OpenCodeSessionIdentifierSchema,
    text: z.string().trim().min(1, OPEN_CODE_MESSAGE_TEXT_REQUIRED_ERROR),
    directory: OpenCodeDirectorySchema.optional()
  })
  .strict();

type OpenCodeListSessionsParsedInput = z.infer<typeof OpenCodeListSessionsInputSchema>;
type OpenCodeCreateSessionParsedInput = z.infer<typeof OpenCodeCreateSessionInputSchema>;
type OpenCodeSessionLookupInput = z.infer<typeof OpenCodeSessionLookupInputSchema>;
type OpenCodeSendMessageParsedInput = z.infer<typeof OpenCodeSendMessageInputSchema>;

interface OpenCodeSessionMessageProjection {
  messageList: OpenCodeMessage[];
  partsByMessageIdentifier: Map<string, OpenCodePart[]>;
}

function parseStructuredDataValue(
  value: OpenCodeStructuredDataValue | undefined
): OpenCodeStructuredDataValue {
  return OpenCodeStructuredDataValueSchema.parse(value);
}

function parseStructuredCollectionValue(
  value: OpenCodeStructuredDataValue | undefined
): OpenCodeStructuredDataValue {
  // OpenCode omits `data` for empty list responses; normalize to a strict empty collection contract.
  return OpenCodeStructuredDataValueSchema.parse(value ?? OPEN_CODE_EMPTY_COLLECTION_VALUE);
}

function parseSessionLookupInput(
  sessionId: string,
  directory: string | undefined
): OpenCodeSessionLookupInput {
  return OpenCodeSessionLookupInputSchema.parse({
    sessionId,
    directory
  });
}

function buildSessionReadRequestFromIdentifiers(
  sessionId: string,
  directory: string | undefined
): OpenCodeSessionReadRequest {
  const parsedInput = parseSessionLookupInput(sessionId, directory);
  return buildSessionReadRequest(parsedInput);
}

function projectSessionMessages(
  messages: OpenCodeSessionMessageEntry[]
): OpenCodeSessionMessageProjection {
  // Conversation mapping needs both stable message order and quick part lookups by message identifier.
  const messageList: OpenCodeMessage[] = [];
  const partsByMessageIdentifier = new Map<string, OpenCodePart[]>();

  for (const entry of messages) {
    messageList.push(entry.info);
    partsByMessageIdentifier.set(entry.info.id, entry.parts);
  }

  return {
    messageList,
    partsByMessageIdentifier
  };
}

function buildDirectoryQuery(directory: string | undefined): OpenCodeDirectoryQuery | undefined {
  if (directory === undefined) {
    return undefined;
  }

  return {
    directory
  };
}

function buildSessionListRequest(
  input: OpenCodeListSessionsParsedInput
): OpenCodeSessionListRequest {
  const directoryQuery = buildDirectoryQuery(input.directory);
  if (directoryQuery === undefined) {
    return {};
  }

  return {
    query: directoryQuery
  };
}

function buildSessionCreateRequest(
  input: OpenCodeCreateSessionParsedInput
): OpenCodeSessionCreateRequest {
  const body = input.title === undefined
    ? {}
    : {
        title: input.title
      };
  const directoryQuery = buildDirectoryQuery(input.directory);

  if (directoryQuery === undefined) {
    return { body };
  }

  return {
    body,
    query: directoryQuery
  };
}

function buildSessionReadRequest(
  input: OpenCodeSessionLookupInput
): OpenCodeSessionReadRequest {
  const directoryQuery = buildDirectoryQuery(input.directory);
  const path = { id: input.sessionId };
  if (directoryQuery === undefined) {
    return { path };
  }

  return {
    path,
    query: directoryQuery
  };
}

function buildPromptBody(text: string): OpenCodeSessionPromptBody {
  return {
    parts: [{
      type: OPEN_CODE_PROMPT_TEXT_PART_TYPE,
      text
    }]
  };
}

function buildSessionPromptRequest(
  input: OpenCodeSendMessageParsedInput
): OpenCodeSessionPromptRequest {
  const directoryQuery = buildDirectoryQuery(input.directory);
  const path = { id: input.sessionId };
  const body = buildPromptBody(input.text);

  if (directoryQuery === undefined) {
    return {
      path,
      body
    };
  }

  return {
    path,
    query: directoryQuery,
    body
  };
}

/**
 * Owns OpenCode session/thread API mapping from SDK payloads into Farfield contracts.
 */
export class OpenCodeMonitorService {
  private readonly connection: OpenCodeConnectionClientProvider;

  public constructor(connection: OpenCodeConnectionClientProvider) {
    this.connection = connection;
  }

  public async listSessions(): Promise<{
    data: MappedThreadListItem[];
  }>;
  public async listSessions(input: {
    directory?: string;
  }): Promise<{
    data: MappedThreadListItem[];
  }>;
  public async listSessions(input?: {
    directory?: string;
  }): Promise<{
    data: MappedThreadListItem[];
  }> {
    const client = this.connection.getClient();
    const parsedInput = OpenCodeListSessionsInputSchema.parse(input ?? {});
    const result = await client.session.list(buildSessionListRequest(parsedInput));
    const sessions = parseOpenCodeSessionList(
      parseStructuredCollectionValue(result.data)
    );

    return {
      data: sessions.map(sessionToThreadListItem)
    };
  }

  public async listProjectDirectories(): Promise<string[]> {
    const client = this.connection.getClient();
    const result = await client.project.list();
    const projects = parseOpenCodeProjectList(
      parseStructuredCollectionValue(result.data)
    );
    return projects.map((project) => OpenCodeDirectorySchema.parse(project.worktree));
  }

  public async createSession(input?: OpenCodeCreateSessionInput): Promise<{
    threadId: string;
    session: OpenCodeSession;
    mapped: MappedThreadListItem;
  }> {
    const client = this.connection.getClient();
    const parsedInput = OpenCodeCreateSessionInputSchema.parse(input ?? {});
    const result = await client.session.create(buildSessionCreateRequest(parsedInput));

    const session = parseOpenCodeSession(
      parseStructuredDataValue(result.data)
    );
    return {
      threadId: session.id,
      session,
      mapped: sessionToThreadListItem(session)
    };
  }

  public async getSession(sessionId: string, directory?: string): Promise<OpenCodeSession> {
    const client = this.connection.getClient();
    const sessionReadRequest = buildSessionReadRequestFromIdentifiers(sessionId, directory);
    const result = await client.session.get(sessionReadRequest);
    return parseOpenCodeSession(parseStructuredDataValue(result.data));
  }

  public async getSessionState(
    sessionId: string,
    directory?: string
  ): Promise<MappedThreadConversationState> {
    const client = this.connection.getClient();
    const sessionReadRequest = buildSessionReadRequestFromIdentifiers(sessionId, directory);

    const [sessionResult, messagesResult] = await Promise.all([
      client.session.get(sessionReadRequest),
      client.session.messages(sessionReadRequest)
    ]);

    const session = parseOpenCodeSession(
      parseStructuredDataValue(sessionResult.data)
    );
    const messages = parseOpenCodeSessionMessages(
      parseStructuredCollectionValue(messagesResult.data)
    );
    const projectedMessages = projectSessionMessages(messages);

    return sessionToConversationState(
      session,
      projectedMessages.messageList,
      projectedMessages.partsByMessageIdentifier
    );
  }

  public async sendMessage(input: OpenCodeSendMessageInput): Promise<void> {
    const parsedInput = OpenCodeSendMessageInputSchema.parse(input);
    const client = this.connection.getClient();
    await client.session.prompt(buildSessionPromptRequest(parsedInput));
  }

  public async abort(sessionId: string, directory?: string): Promise<void> {
    const client = this.connection.getClient();
    await client.session.abort(buildSessionReadRequestFromIdentifiers(sessionId, directory));
  }

  public async deleteSession(sessionId: string, directory?: string): Promise<void> {
    const client = this.connection.getClient();
    await client.session.delete(buildSessionReadRequestFromIdentifiers(sessionId, directory));
  }
}

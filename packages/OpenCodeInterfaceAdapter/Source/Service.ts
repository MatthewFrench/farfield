import type { OpenCodeConnectionClientProvider } from "./ClientContracts.js";
import type { MappedThreadConversationState, MappedThreadListItem } from "./MapperContracts.js";
import type { OpenCodeSession } from "./Schemas.js";
import {
  parseOpenCodeProjectList,
  parseOpenCodeSession,
  parseOpenCodeSessionList,
  parseOpenCodeSessionMessages,
} from "./Schemas.js";
import {
  type OpenCodeCreateSessionInput,
  type OpenCodeListSessionsInput,
  type OpenCodeSendMessageInput,
  parseCreateSessionInput,
  parseListSessionsInput,
  parseProjectDirectory,
  parseSendMessageInput,
  parseSessionLookupInput,
  parseStructuredCollectionValue,
  parseStructuredDataValue,
} from "./ServiceBoundaryContracts.js";
import {
  buildSessionCreateRequest,
  buildSessionListRequest,
  buildSessionPromptRequest,
  buildSessionReadRequest,
} from "./ServiceRequestBuilder.js";
import { sessionToConversationState, sessionToThreadListItem } from "./SessionMapper.js";
import { projectSessionMessages } from "./SessionMessageProjection.js";

export type {
  OpenCodeCreateSessionInput,
  OpenCodeSendMessageInput,
} from "./ServiceBoundaryContracts.js";

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
  public async listSessions(input: OpenCodeListSessionsInput): Promise<{
    data: MappedThreadListItem[];
  }>;
  public async listSessions(input?: OpenCodeListSessionsInput): Promise<{
    data: MappedThreadListItem[];
  }> {
    const client = this.connection.getClient();
    const parsedInput = parseListSessionsInput(input);
    const result = await client.session.list(buildSessionListRequest(parsedInput));
    const sessions = parseOpenCodeSessionList(parseStructuredCollectionValue(result.data));

    return {
      data: sessions.map(sessionToThreadListItem),
    };
  }

  public async listProjectDirectories(): Promise<string[]> {
    const client = this.connection.getClient();
    const result = await client.project.list();
    const projects = parseOpenCodeProjectList(parseStructuredCollectionValue(result.data));
    return projects.map((project) => parseProjectDirectory(project.worktree));
  }

  public async createSession(input?: OpenCodeCreateSessionInput): Promise<{
    threadId: string;
    session: OpenCodeSession;
    mapped: MappedThreadListItem;
  }> {
    const client = this.connection.getClient();
    const parsedInput = parseCreateSessionInput(input);
    const result = await client.session.create(buildSessionCreateRequest(parsedInput));

    const session = parseOpenCodeSession(parseStructuredDataValue(result.data));
    return {
      threadId: session.id,
      session,
      mapped: sessionToThreadListItem(session),
    };
  }

  public async getSession(sessionId: string, directory?: string): Promise<OpenCodeSession> {
    const client = this.connection.getClient();
    const sessionLookupInput = parseSessionLookupInput(sessionId, directory);
    const sessionReadRequest = buildSessionReadRequest(sessionLookupInput);
    const result = await client.session.get(sessionReadRequest);
    return parseOpenCodeSession(parseStructuredDataValue(result.data));
  }

  public async getSessionState(
    sessionId: string,
    directory?: string,
  ): Promise<MappedThreadConversationState> {
    const client = this.connection.getClient();
    const sessionLookupInput = parseSessionLookupInput(sessionId, directory);
    const sessionReadRequest = buildSessionReadRequest(sessionLookupInput);

    const [sessionResult, messagesResult] = await Promise.all([
      client.session.get(sessionReadRequest),
      client.session.messages(sessionReadRequest),
    ]);

    const session = parseOpenCodeSession(parseStructuredDataValue(sessionResult.data));
    const messages = parseOpenCodeSessionMessages(
      parseStructuredCollectionValue(messagesResult.data),
    );
    const projectedMessages = projectSessionMessages(messages);

    return sessionToConversationState(
      session,
      projectedMessages.messageList,
      projectedMessages.partsByMessageIdentifier,
    );
  }

  public async sendMessage(input: OpenCodeSendMessageInput): Promise<void> {
    const parsedInput = parseSendMessageInput(input);
    const client = this.connection.getClient();
    await client.session.prompt(buildSessionPromptRequest(parsedInput));
  }

  public async abort(sessionId: string, directory?: string): Promise<void> {
    const client = this.connection.getClient();
    const sessionLookupInput = parseSessionLookupInput(sessionId, directory);
    await client.session.abort(buildSessionReadRequest(sessionLookupInput));
  }

  public async deleteSession(sessionId: string, directory?: string): Promise<void> {
    const client = this.connection.getClient();
    const sessionLookupInput = parseSessionLookupInput(sessionId, directory);
    await client.session.delete(buildSessionReadRequest(sessionLookupInput));
  }
}

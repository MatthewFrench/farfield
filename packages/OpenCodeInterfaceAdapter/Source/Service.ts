import type { OpenCodeConnection } from "./Client.js";
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
  type OpenCodeSession
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

export class OpenCodeMonitorService {
  private readonly connection: OpenCodeConnection;

  public constructor(connection: OpenCodeConnection) {
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
    const directory = input?.directory?.trim();
    const result = await client.session.list(
      directory
        ? {
            query: {
              directory
            }
          }
        : {}
    );
    const sessions = parseOpenCodeSessionList(
      OpenCodeStructuredDataValueSchema.parse(result.data ?? [])
    );

    return {
      data: sessions.map(sessionToThreadListItem)
    };
  }

  public async listProjectDirectories(): Promise<string[]> {
    const client = this.connection.getClient();
    const result = await client.project.list();
    const projects = parseOpenCodeProjectList(
      OpenCodeStructuredDataValueSchema.parse(result.data ?? [])
    );
    return projects
      .map((project) => project.worktree)
      .filter((directory) => directory.trim().length > 0);
  }

  public async createSession(input?: OpenCodeCreateSessionInput): Promise<{
    threadId: string;
    session: OpenCodeSession;
    mapped: MappedThreadListItem;
  }> {
    const client = this.connection.getClient();
    const directory = input?.directory?.trim();
    const body: Record<string, string> = {};
    if (input?.title) {
      body["title"] = input.title;
    }
    const result = await client.session.create({
      body,
      ...(directory
        ? {
            query: {
              directory
            }
          }
        : {})
    });

    const session = parseOpenCodeSession(
      OpenCodeStructuredDataValueSchema.parse(result.data)
    );
    return {
      threadId: session.id,
      session,
      mapped: sessionToThreadListItem(session)
    };
  }

  public async getSession(sessionId: string, directory?: string): Promise<OpenCodeSession> {
    const client = this.connection.getClient();
    const normalizedDirectory = directory?.trim();
    const result = await client.session.get({
      path: { id: sessionId },
      ...(normalizedDirectory
        ? {
            query: {
              directory: normalizedDirectory
            }
          }
        : {})
    });
    return parseOpenCodeSession(OpenCodeStructuredDataValueSchema.parse(result.data));
  }

  public async getSessionState(
    sessionId: string,
    directory?: string
  ): Promise<MappedThreadConversationState> {
    const client = this.connection.getClient();
    const normalizedDirectory = directory?.trim();

    const [sessionResult, messagesResult] = await Promise.all([
      client.session.get({
        path: { id: sessionId },
        ...(normalizedDirectory
          ? {
              query: {
                directory: normalizedDirectory
              }
            }
          : {})
      }),
      client.session.messages({
        path: { id: sessionId },
        ...(normalizedDirectory
          ? {
              query: {
                directory: normalizedDirectory
              }
            }
          : {})
      })
    ]);

    const session = parseOpenCodeSession(
      OpenCodeStructuredDataValueSchema.parse(sessionResult.data)
    );
    const messages = parseOpenCodeSessionMessages(
      OpenCodeStructuredDataValueSchema.parse(messagesResult.data ?? [])
    );

    const messageList: OpenCodeMessage[] = [];
    const partsByMessage = new Map<string, OpenCodePart[]>();

    for (const entry of messages) {
      messageList.push(entry.info);
      partsByMessage.set(entry.info.id, entry.parts);
    }

    return sessionToConversationState(session, messageList, partsByMessage);
  }

  public async sendMessage(input: OpenCodeSendMessageInput): Promise<void> {
    const text = input.text.trim();
    if (!text) {
      throw new Error("Message text is required");
    }

    const client = this.connection.getClient();
    const directory = input.directory?.trim();
    await client.session.prompt({
      path: { id: input.sessionId },
      ...(directory
        ? {
            query: {
              directory
            }
          }
        : {}),
      body: {
        parts: [
          { type: "text", text }
        ]
      }
    });
  }

  public async abort(sessionId: string, directory?: string): Promise<void> {
    const client = this.connection.getClient();
    const normalizedDirectory = directory?.trim();
    await client.session.abort({
      path: { id: sessionId },
      ...(normalizedDirectory
        ? {
            query: {
              directory: normalizedDirectory
            }
          }
        : {})
    });
  }

  public async deleteSession(sessionId: string, directory?: string): Promise<void> {
    const client = this.connection.getClient();
    const normalizedDirectory = directory?.trim();
    await client.session.delete({
      path: { id: sessionId },
      ...(normalizedDirectory
        ? {
            query: {
              directory: normalizedDirectory
            }
          }
        : {})
    });
  }
}

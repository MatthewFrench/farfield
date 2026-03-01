import { OpenCodeConnection, OpenCodeMonitorService } from "@farfield/opencode-api";
import {
  AppServerThreadListItemSchema,
  JsonValueSchema,
  parseThreadConversationState,
} from "@farfield/protocol";
import type {
  AgentAdapter,
  AgentCapabilities,
  AgentCreateThreadInput,
  AgentCreateThreadResult,
  AgentInterruptInput,
  AgentListThreadsInput,
  AgentListThreadsResult,
  AgentReadThreadInput,
  AgentReadThreadResult,
  AgentSendMessageInput,
} from "../Types.js";
import { OpenCodeDirectoryOwner } from "./OpenCodeDirectoryOwner.js";
import { OpenCodeThreadListingOwner } from "./OpenCodeThreadListingOwner.js";

const OPEN_CODE_NOT_CONNECTED_ERROR_MESSAGE = "OpenCode backend is not connected";

export interface OpenCodeAgentOptions {
  url?: string;
  port?: number;
}

/**
 * Composition owner for OpenCode integration.
 * Directory/state cache ownership and thread-list pagination are delegated to dedicated owners.
 */
export class OpenCodeAgentAdapter implements AgentAdapter {
  public readonly id = "opencode";
  public readonly label = "OpenCode";
  public readonly capabilities: AgentCapabilities = {
    canListModels: false,
    canListCollaborationModes: false,
    canReadConfigRequirements: false,
    canListExperimentalFeatures: false,
    canListMcpServerStatuses: false,
    canListApps: false,
    canListSkills: false,
    canReadAccount: false,
    canReadAccountRateLimits: false,
    canSearchFuzzyFiles: false,
    canExecuteCommand: false,
    canStartAccountLogin: false,
    canCancelAccountLogin: false,
    canLogoutAccount: false,
    canReloadMcpServerConfig: false,
    canStartMcpServerOauthLogin: false,
    canWriteConfigValue: false,
    canWriteSkillsConfig: false,
    canDetectExternalAgentConfig: false,
    canImportExternalAgentConfig: false,
    canStartThreadRealtime: false,
    canAppendThreadRealtimeAudio: false,
    canAppendThreadRealtimeText: false,
    canStopThreadRealtime: false,
    canStartWindowsSandboxSetup: false,
    canSetCollaborationMode: false,
    canSubmitUserInput: false,
    canReadLiveState: false,
    canReadStreamEvents: false,
  };

  private readonly connection: OpenCodeConnection;
  private readonly service: OpenCodeMonitorService;
  private readonly directoryOwner: OpenCodeDirectoryOwner;
  private readonly threadListingOwner: OpenCodeThreadListingOwner;

  public constructor(options: OpenCodeAgentOptions = {}) {
    this.connection = new OpenCodeConnection({
      ...(options.url !== undefined && options.url.length > 0 ? { url: options.url } : {}),
      ...(options.port !== undefined ? { port: options.port } : {}),
    });
    this.service = new OpenCodeMonitorService(this.connection);
    this.directoryOwner = new OpenCodeDirectoryOwner();
    this.threadListingOwner = new OpenCodeThreadListingOwner({
      parseThreadListItem: (session) => AppServerThreadListItemSchema.parse(session),
      listSessions: (input) => {
        if (input === undefined) {
          return this.service.listSessions();
        }
        return this.service.listSessions(input);
      },
      resolveSessionDirectories: (inputDirectory) => {
        return this.directoryOwner.resolveSessionDirectories(inputDirectory, async () =>
          this.listProjectDirectories(),
        );
      },
      cacheThreadDirectory: (threadId, directory) => {
        this.directoryOwner.cacheThreadDirectory(threadId, directory);
      },
    });
  }

  public getUrl(): string | null {
    return this.connection.getUrl();
  }

  public isEnabled(): boolean {
    return true;
  }

  public isConnected(): boolean {
    return this.connection.isConnected();
  }

  public async start(): Promise<void> {
    await this.connection.start();
  }

  public async stop(): Promise<void> {
    await this.connection.stop();
  }

  public async listThreads(input: AgentListThreadsInput): Promise<AgentListThreadsResult> {
    this.ensureConnected();
    return this.threadListingOwner.listThreads(input);
  }

  public async createThread(input: AgentCreateThreadInput): Promise<AgentCreateThreadResult> {
    this.ensureConnected();

    const directory =
      input.cwd !== undefined ? this.directoryOwner.normalizeDirectoryInput(input.cwd) : undefined;
    const result = await this.service.createSession({
      ...(input.model !== undefined ? { title: input.model } : {}),
      ...(directory !== undefined && directory.length > 0 ? { directory } : {}),
    });

    if (result.mapped.cwd !== undefined && result.mapped.cwd.trim().length > 0) {
      this.directoryOwner.cacheThreadDirectory(result.threadId, result.mapped.cwd);
    } else if (directory !== undefined && directory.length > 0) {
      this.directoryOwner.cacheThreadDirectory(result.threadId, directory);
    }

    const mappedThread = AppServerThreadListItemSchema.parse(result.mapped);

    return {
      threadId: result.threadId,
      thread: mappedThread,
      cwd: mappedThread.cwd,
    };
  }

  public async readThread(input: AgentReadThreadInput): Promise<AgentReadThreadResult> {
    this.ensureConnected();

    const directory = this.directoryOwner.resolveThreadDirectory(input.threadId);
    const state = await this.service.getSessionState(input.threadId, directory);
    this.directoryOwner.cacheThreadDirectory(input.threadId, state.cwd);

    return {
      thread: parseThreadConversationState(JsonValueSchema.parse(state)),
    };
  }

  public async sendMessage(input: AgentSendMessageInput): Promise<void> {
    this.ensureConnected();

    const directory =
      input.cwd !== undefined
        ? this.directoryOwner.normalizeDirectoryInput(input.cwd)
        : this.directoryOwner.resolveThreadDirectory(input.threadId);

    await this.service.sendMessage({
      sessionId: input.threadId,
      text: input.text,
      ...(directory !== undefined && directory.length > 0 ? { directory } : {}),
    });
  }

  public async interrupt(input: AgentInterruptInput): Promise<void> {
    this.ensureConnected();
    const directory = this.directoryOwner.resolveThreadDirectory(input.threadId);
    await this.service.abort(input.threadId, directory);
  }

  public async listProjectDirectories(): Promise<string[]> {
    this.ensureConnected();
    const directories = await this.service.listProjectDirectories();
    return this.directoryOwner.normalizeDirectoryList(directories);
  }

  private ensureConnected(): void {
    if (!this.connection.isConnected()) {
      throw new Error(OPEN_CODE_NOT_CONNECTED_ERROR_MESSAGE);
    }
  }
}

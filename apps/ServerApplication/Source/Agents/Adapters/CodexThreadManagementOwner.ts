import { AppServerClient } from "@farfield/api";
import type {
  AppServerCollaborationModeListResponse,
  AppServerListModelsResponse
} from "@farfield/protocol";
import type {
  AgentArchiveThreadInput,
  AgentConfigDefaults,
  AgentCreateThreadInput,
  AgentCreateThreadResult,
  AgentListThreadsInput,
  AgentListThreadsResult,
  AgentReadThreadInput,
  AgentReadThreadResult,
  AgentUnarchiveThreadInput
} from "../Types.js";

export interface CodexThreadManagementOwnerOptions {
  appClient: AppServerClient;
  runAppServerCall: <ValueType>(operation: () => Promise<ValueType>) => Promise<ValueType>;
  ensureCodexAvailable: () => void;
}

export class CodexThreadManagementOwner {
  private readonly appClient: AppServerClient;
  private readonly runAppServerCall: <ValueType>(operation: () => Promise<ValueType>) => Promise<ValueType>;
  private readonly ensureCodexAvailable: () => void;

  public constructor(options: CodexThreadManagementOwnerOptions) {
    this.appClient = options.appClient;
    this.runAppServerCall = options.runAppServerCall;
    this.ensureCodexAvailable = options.ensureCodexAvailable;
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

  public async archiveThread(input: AgentArchiveThreadInput): Promise<void> {
    this.ensureCodexAvailable();
    await this.runAppServerCall(() => this.appClient.archiveThread(input.threadId));
  }

  public async unarchiveThread(input: AgentUnarchiveThreadInput): Promise<void> {
    this.ensureCodexAvailable();
    await this.runAppServerCall(() => this.appClient.unarchiveThread(input.threadId));
  }

  public async listModels(limit: number): Promise<AppServerListModelsResponse> {
    this.ensureCodexAvailable();
    return this.runAppServerCall(() => this.appClient.listModels(limit));
  }

  public async listCollaborationModes(): Promise<AppServerCollaborationModeListResponse> {
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
}

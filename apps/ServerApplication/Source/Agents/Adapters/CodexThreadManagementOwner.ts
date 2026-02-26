import {
  AppServerClient,
  type ListThreadsAllOptions,
  type ListThreadsOptions,
  type StartThreadOptions
} from "@farfield/api";
import type {
  AppServerCollaborationModeListResponse,
  AppServerListModelsResponse,
  AppServerListThreadsResponse
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

const CREATE_THREAD_REQUIRES_WORKING_DIRECTORY_ERROR = "Codex thread creation requires cwd";

function buildListThreadsOptions(input: AgentListThreadsInput): ListThreadsOptions {
  return {
    limit: input.limit,
    archived: input.archived,
    sortKey: input.sortKey,
    ...(input.cursor ? { cursor: input.cursor } : {}),
    ...(input.cwd ? { cwd: input.cwd } : {})
  };
}

function buildListThreadsAllOptions(input: AgentListThreadsInput): ListThreadsAllOptions {
  return {
    ...buildListThreadsOptions(input),
    maxPages: input.maxPages
  };
}

function mapListThreadsResult(result: AppServerListThreadsResponse): AgentListThreadsResult {
  const mappedResult: AgentListThreadsResult = {
    data: result.data,
    nextCursor: result.nextCursor ?? null
  };

  if (result.pages !== undefined) {
    mappedResult.pages = result.pages;
  }

  if (result.truncated !== undefined) {
    mappedResult.truncated = result.truncated;
  }

  return mappedResult;
}

function readRequiredWorkingDirectory(input: AgentCreateThreadInput): string {
  const workingDirectory = input.cwd?.trim();
  if (!workingDirectory) {
    throw new Error(CREATE_THREAD_REQUIRES_WORKING_DIRECTORY_ERROR);
  }

  return workingDirectory;
}

function buildStartThreadOptions(
  input: AgentCreateThreadInput,
  workingDirectory: string
): StartThreadOptions {
  return {
    cwd: workingDirectory,
    ...(input.model ? { model: input.model } : {}),
    ...(input.modelProvider ? { modelProvider: input.modelProvider } : {}),
    ...(input.personality ? { personality: input.personality } : {}),
    ...(input.sandbox ? { sandbox: input.sandbox } : {}),
    ...(input.approvalPolicy ? { approvalPolicy: input.approvalPolicy } : {}),
    ...(input.ephemeral !== undefined ? { ephemeral: input.ephemeral } : {})
  };
}

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
        ? this.appClient.listThreadsAll(buildListThreadsAllOptions(input))
        : this.appClient.listThreads(buildListThreadsOptions(input))
    );

    return mapListThreadsResult(result);
  }

  public async createThread(input: AgentCreateThreadInput): Promise<AgentCreateThreadResult> {
    this.ensureCodexAvailable();

    const workingDirectory = readRequiredWorkingDirectory(input);

    const result = await this.runAppServerCall(() =>
      this.appClient.startThread(buildStartThreadOptions(input, workingDirectory))
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

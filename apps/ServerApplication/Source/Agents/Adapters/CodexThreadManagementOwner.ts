import {
  AppServerClient,
  type ListThreadsAllOptions,
  type ListThreadsOptions,
  type StartThreadOptions
} from "@farfield/api";
import type {
  AppServerCollaborationModeListResponse,
  AppServerConfigReadResponse,
  AppServerListModelsResponse,
  AppServerListThreadsResponse,
  AppServerStartThreadResponse
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
const READ_CONFIG_DEFAULTS_OPTIONS = {
  includeLayers: false
};

function buildListThreadsOptions(input: AgentListThreadsInput): ListThreadsOptions {
  return {
    limit: input.limit,
    archived: input.archived,
    sortKey: input.sortKey,
    ...(input.cursor !== null ? { cursor: input.cursor } : {}),
    ...(input.cwd !== null ? { cwd: input.cwd } : {})
  };
}

function buildListThreadsAllOptions(input: AgentListThreadsInput): ListThreadsAllOptions {
  return {
    ...buildListThreadsOptions(input),
    maxPages: input.maxPages
  };
}

function buildListThreadsOperation(
  appClient: AppServerClient,
  input: AgentListThreadsInput
): () => Promise<AppServerListThreadsResponse> {
  if (input.all) {
    return () => appClient.listThreadsAll(buildListThreadsAllOptions(input));
  }

  return () => appClient.listThreads(buildListThreadsOptions(input));
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
  if (workingDirectory === undefined || workingDirectory.length === 0) {
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
    ...(input.model !== undefined ? { model: input.model } : {}),
    ...(input.modelProvider !== undefined ? { modelProvider: input.modelProvider } : {}),
    ...(input.personality !== undefined ? { personality: input.personality } : {}),
    ...(input.sandbox !== undefined ? { sandbox: input.sandbox } : {}),
    ...(input.approvalPolicy !== undefined ? { approvalPolicy: input.approvalPolicy } : {}),
    ...(input.ephemeral !== undefined ? { ephemeral: input.ephemeral } : {})
  };
}

function mapCreateThreadResult(result: AppServerStartThreadResponse): AgentCreateThreadResult {
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

function readActiveConfigProfile(
  config: AppServerConfigReadResponse["config"]
): AppServerConfigReadResponse["config"]["profiles"][string] | null {
  if (config.profile === null || config.profile.length === 0) {
    return null;
  }

  return config.profiles[config.profile] ?? null;
}

function mapConfigDefaults(configResponse: AppServerConfigReadResponse): AgentConfigDefaults {
  const activeProfile = readActiveConfigProfile(configResponse.config);

  return {
    model: activeProfile?.model ?? configResponse.config.model ?? null,
    reasoningEffort:
      activeProfile?.model_reasoning_effort ?? configResponse.config.model_reasoning_effort ?? null
  };
}

export interface CodexThreadManagementOwnerOptions {
  appClient: AppServerClient;
  runAppServerCall: <ValueType>(operation: () => Promise<ValueType>) => Promise<ValueType>;
  ensureCodexAvailable: () => void;
}

/**
 * Owns Codex thread-management calls and maps app-server payload contracts to
 * server-agent contracts consumed by route and adapter owners.
 */
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

    const result = await this.runAppServerCall(buildListThreadsOperation(this.appClient, input));

    return mapListThreadsResult(result);
  }

  public async createThread(input: AgentCreateThreadInput): Promise<AgentCreateThreadResult> {
    this.ensureCodexAvailable();

    const workingDirectory = readRequiredWorkingDirectory(input);

    const result = await this.runAppServerCall(() =>
      this.appClient.startThread(buildStartThreadOptions(input, workingDirectory))
    );

    return mapCreateThreadResult(result);
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
    const config = await this.runAppServerCall(() => this.appClient.readConfig(READ_CONFIG_DEFAULTS_OPTIONS));
    return mapConfigDefaults(config);
  }
}

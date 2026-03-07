// biome-ignore lint/nursery/noExcessiveLinesPerFile: Adapter owner extraction is tracked in docs/proposed-structure-and-migration.md decision entry 20.
import {
  AppServerClient,
  type CancelAccountLoginOptions,
  type CancelAccountLoginResult,
  type CommandExecutionResult,
  type ConfigWriteResult,
  type ExportRemoteSkillOptions,
  type ExportRemoteSkillResult,
  type ExternalAgentConfigDetectOptions,
  type ExternalAgentConfigDetectResult,
  type ExternalAgentConfigImportOptions,
  type ExternalAgentConfigImportResult,
  type FeedbackUploadOptions,
  type FeedbackUploadResult,
  type FuzzyFileSearchOptions,
  type FuzzyFileSearchResult,
  type FuzzyFileSearchSessionStartOptions,
  type FuzzyFileSearchSessionStartResult,
  type FuzzyFileSearchSessionStopOptions,
  type FuzzyFileSearchSessionStopResult,
  type FuzzyFileSearchSessionUpdateOptions,
  type FuzzyFileSearchSessionUpdateResult,
  type GitDiffToRemoteOptions,
  type GitDiffToRemoteResult,
  type ListAppsOptions,
  type ListAppsResult,
  type ListExperimentalFeaturesOptions,
  type ListExperimentalFeaturesResult,
  type ListLoadedThreadsResult,
  type ListMcpServerStatusesOptions,
  type ListMcpServerStatusesResult,
  type ListRemoteSkillsOptions,
  type ListRemoteSkillsResult,
  type ListSkillsOptions,
  type ListSkillsResult,
  type ListThreadsAllOptions,
  type ListThreadsOptions,
  type LoginAccountOptions,
  type LoginAccountResult,
  type ReadAccountOptions,
  type ReadAccountRateLimitsResult,
  type ReadAccountResult,
  type ReadAuthStatusOptions,
  type ReadAuthStatusResult,
  type ReadConfigRequirementsOptions,
  type ReadConfigRequirementsResult,
  type ReadUserInfoResult,
  type StartMcpServerOauthLoginResult,
  type StartReviewOptions,
  type StartThreadOptions,
  type ThreadRealtimeAppendAudioOptions,
  type ThreadRealtimeAppendAudioResult,
  type ThreadRealtimeAppendTextOptions,
  type ThreadRealtimeAppendTextResult,
  type ThreadRealtimeStartOptions,
  type ThreadRealtimeStartResult,
  type ThreadRealtimeStopOptions,
  type ThreadRealtimeStopResult,
  type WindowsSandboxSetupStartOptions,
  type WindowsSandboxSetupStartResult,
  type WriteSkillsConfigResult,
} from "@farfield/api";
import type {
  AppServerCollaborationModeListResponse,
  AppServerConfigReadResponse,
  AppServerListModelsResponse,
  AppServerListThreadsResponse,
  AppServerStartThreadResponse,
} from "@farfield/protocol";
import type {
  AgentAppendThreadRealtimeAudioInput,
  AgentAppendThreadRealtimeAudioResult,
  AgentAppendThreadRealtimeTextInput,
  AgentAppendThreadRealtimeTextResult,
  AgentArchiveThreadInput,
  AgentCancelAccountLoginInput,
  AgentCancelAccountLoginResult,
  AgentCleanThreadBackgroundTerminalsInput,
  AgentCommandExecutionInput,
  AgentCommandExecutionResult,
  AgentCompactThreadInput,
  AgentConfigDefaults,
  AgentCreateThreadInput,
  AgentCreateThreadResult,
  AgentDetectExternalAgentConfigInput,
  AgentDetectExternalAgentConfigResult,
  AgentExportRemoteSkillInput,
  AgentExportRemoteSkillResult,
  AgentForkThreadInput,
  AgentFuzzyFileSearchInput,
  AgentFuzzyFileSearchResult,
  AgentFuzzyFileSearchSessionStartInput,
  AgentFuzzyFileSearchSessionStartResult,
  AgentFuzzyFileSearchSessionStopInput,
  AgentFuzzyFileSearchSessionStopResult,
  AgentFuzzyFileSearchSessionUpdateInput,
  AgentFuzzyFileSearchSessionUpdateResult,
  AgentGitDiffToRemoteInput,
  AgentGitDiffToRemoteResult,
  AgentImportExternalAgentConfigInput,
  AgentImportExternalAgentConfigResult,
  AgentListAppsInput,
  AgentListAppsResult,
  AgentListExperimentalFeaturesInput,
  AgentListExperimentalFeaturesResult,
  AgentListLoadedThreadsResult,
  AgentListMcpServerStatusesInput,
  AgentListMcpServerStatusesResult,
  AgentListRemoteSkillsInput,
  AgentListRemoteSkillsResult,
  AgentListSkillsInput,
  AgentListSkillsResult,
  AgentListThreadsInput,
  AgentListThreadsResult,
  AgentReadAccountInput,
  AgentReadAccountRateLimitsInput,
  AgentReadAccountRateLimitsResult,
  AgentReadAccountResult,
  AgentReadAuthStatusInput,
  AgentReadAuthStatusResult,
  AgentReadConfigRequirementsInput,
  AgentReadConfigRequirementsResult,
  AgentReadThreadInput,
  AgentReadThreadResult,
  AgentReadUserInfoResult,
  AgentRollbackThreadInput,
  AgentSetThreadNameInput,
  AgentStartAccountLoginInput,
  AgentStartAccountLoginResult,
  AgentStartMcpServerOauthLoginInput,
  AgentStartMcpServerOauthLoginResult,
  AgentStartThreadRealtimeInput,
  AgentStartThreadRealtimeResult,
  AgentStartThreadReviewInput,
  AgentStartThreadReviewResult,
  AgentStartWindowsSandboxSetupInput,
  AgentStartWindowsSandboxSetupResult,
  AgentStopThreadRealtimeInput,
  AgentStopThreadRealtimeResult,
  AgentUnarchiveThreadInput,
  AgentUnsubscribeThreadInput,
  AgentUnsubscribeThreadStatus,
  AgentUploadFeedbackInput,
  AgentUploadFeedbackResult,
  AgentWriteConfigBatchInput,
  AgentWriteConfigValueInput,
  AgentWriteConfigValueResult,
  AgentWriteSkillsConfigInput,
  AgentWriteSkillsConfigResult,
} from "../Types.js";
import {
  buildCommandExecutionOptions,
  buildExternalAgentConfigDetectOptions,
  buildExternalAgentConfigImportOptions,
  buildFeedbackUploadOptions,
  buildStartMcpServerOauthLoginOptions,
  buildThreadRealtimeAppendAudioOptions,
  buildThreadRealtimeAppendTextOptions,
  buildThreadRealtimeStartOptions,
  buildThreadRealtimeStopOptions,
  buildWindowsSandboxSetupStartOptions,
  buildWriteConfigBatchOptions,
  buildWriteConfigValueOptions,
  buildWriteSkillsConfigOptions,
} from "./CodexThreadManagementCapabilityMutationOptions.js";

const CREATE_THREAD_REQUIRES_WORKING_DIRECTORY_ERROR = "Codex thread creation requires cwd";
const FORK_WITH_EXTENDED_HISTORY = true;
const READ_THREAD_RESUME_WITH_EXTENDED_HISTORY = true;
const READ_CONFIG_DEFAULTS_OPTIONS = {
  includeLayers: false,
};
const LIST_LOADED_THREADS_PAGE_LIMIT = 200;
const LIST_LOADED_THREADS_MAXIMUM_PAGES = 25;
const PROJECTED_UNREAD_SIGNAL_UNAVAILABLE = null;

function buildListThreadsOptions(input: AgentListThreadsInput): ListThreadsOptions {
  return {
    limit: input.limit,
    archived: input.archived,
    sortKey: input.sortKey,
    ...(input.cursor !== null ? { cursor: input.cursor } : {}),
    ...(input.cwd !== null ? { cwd: input.cwd } : {}),
  };
}

function buildListThreadsAllOptions(input: AgentListThreadsInput): ListThreadsAllOptions {
  return {
    ...buildListThreadsOptions(input),
    maxPages: input.maxPages,
  };
}

function buildListThreadsOperation(
  appClient: AppServerClient,
  input: AgentListThreadsInput,
): () => Promise<AppServerListThreadsResponse> {
  if (input.all) {
    return () => appClient.listThreadsAll(buildListThreadsAllOptions(input));
  }

  return () => appClient.listThreads(buildListThreadsOptions(input));
}

type ReadProjectedHasUnreadTurnSignal = (threadId: string) => boolean | null;

function mapThreadListItemWithProjectedUnreadSignal(
  thread: AppServerListThreadsResponse["data"][number],
  readProjectedHasUnreadTurnSignal: ReadProjectedHasUnreadTurnSignal,
): AppServerListThreadsResponse["data"][number] {
  const projectedHasUnreadTurnSignal = readProjectedHasUnreadTurnSignal(thread.id);
  if (projectedHasUnreadTurnSignal === PROJECTED_UNREAD_SIGNAL_UNAVAILABLE) {
    return thread;
  }

  return {
    ...thread,
    hasUnreadTurn: projectedHasUnreadTurnSignal,
  };
}

function mapListThreadsResult(
  result: AppServerListThreadsResponse,
  readProjectedHasUnreadTurnSignal: ReadProjectedHasUnreadTurnSignal,
): AgentListThreadsResult {
  const mappedResult: AgentListThreadsResult = {
    data: result.data.map((thread) =>
      mapThreadListItemWithProjectedUnreadSignal(thread, readProjectedHasUnreadTurnSignal),
    ),
    nextCursor: result.nextCursor ?? null,
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
  workingDirectory: string,
): StartThreadOptions {
  return {
    cwd: workingDirectory,
    ...(input.model !== undefined ? { model: input.model } : {}),
    ...(input.modelProvider !== undefined ? { modelProvider: input.modelProvider } : {}),
    ...(input.personality !== undefined ? { personality: input.personality } : {}),
    ...(input.sandbox !== undefined ? { sandbox: input.sandbox } : {}),
    ...(input.approvalPolicy !== undefined ? { approvalPolicy: input.approvalPolicy } : {}),
    ...(input.ephemeral !== undefined ? { ephemeral: input.ephemeral } : {}),
  };
}

function buildStartReviewOptions(input: AgentStartThreadReviewInput): StartReviewOptions {
  return {
    threadId: input.threadId,
    target: input.target,
    ...(input.delivery !== undefined ? { delivery: input.delivery } : {}),
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
    reasoningEffort: result.reasoningEffort,
  };
}

function readActiveConfigProfile(
  config: AppServerConfigReadResponse["config"],
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
      activeProfile?.model_reasoning_effort ?? configResponse.config.model_reasoning_effort ?? null,
  };
}

function mergeLoadedThreadIdentifiers(
  accumulator: Set<string>,
  loadedThreadsResult: ListLoadedThreadsResult,
): void {
  for (const threadId of loadedThreadsResult.data) {
    accumulator.add(threadId);
  }
}

function buildReadConfigRequirementsOptions(
  _input?: AgentReadConfigRequirementsInput,
): ReadConfigRequirementsOptions {
  return {};
}

function buildReadAccountOptions(input?: AgentReadAccountInput): ReadAccountOptions {
  return {
    ...(input?.refreshToken !== undefined ? { refreshToken: input.refreshToken } : {}),
  };
}

function buildReadAuthStatusOptions(input?: AgentReadAuthStatusInput): ReadAuthStatusOptions {
  return {
    ...(input?.includeToken !== undefined ? { includeToken: input.includeToken } : {}),
    ...(input?.refreshToken !== undefined ? { refreshToken: input.refreshToken } : {}),
  };
}

function buildStartAccountLoginOptions(input: AgentStartAccountLoginInput): LoginAccountOptions {
  if (input.type === "apiKey") {
    return {
      type: "apiKey",
      apiKey: input.apiKey,
    };
  }

  if (input.type === "chatgpt") {
    return {
      type: "chatgpt",
    };
  }

  return {
    type: "chatgptAuthTokens",
    accessToken: input.accessToken,
    chatgptAccountId: input.chatgptAccountId,
    ...(input.chatgptPlanType !== undefined ? { chatgptPlanType: input.chatgptPlanType } : {}),
  };
}

function buildCancelAccountLoginOptions(
  input: AgentCancelAccountLoginInput,
): CancelAccountLoginOptions {
  return {
    loginId: input.loginId,
  };
}

function buildListRemoteSkillsOptions(input: AgentListRemoteSkillsInput): ListRemoteSkillsOptions {
  return {
    hazelnutScope: input.hazelnutScope,
    productSurface: input.productSurface,
    enabled: input.enabled,
  };
}

function buildExportRemoteSkillOptions(
  input: AgentExportRemoteSkillInput,
): ExportRemoteSkillOptions {
  return {
    hazelnutId: input.hazelnutId,
  };
}

function buildGitDiffToRemoteOptions(input: AgentGitDiffToRemoteInput): GitDiffToRemoteOptions {
  return {
    cwd: input.cwd,
  };
}

function buildFuzzyFileSearchOptions(input: AgentFuzzyFileSearchInput): FuzzyFileSearchOptions {
  return {
    query: input.query,
    roots: input.roots,
    ...(input.cancellationToken !== undefined
      ? { cancellationToken: input.cancellationToken }
      : {}),
  };
}

function buildFuzzyFileSearchSessionStartOptions(
  input: AgentFuzzyFileSearchSessionStartInput,
): FuzzyFileSearchSessionStartOptions {
  return {
    sessionId: input.sessionId,
    roots: input.roots,
  };
}

function buildFuzzyFileSearchSessionUpdateOptions(
  input: AgentFuzzyFileSearchSessionUpdateInput,
): FuzzyFileSearchSessionUpdateOptions {
  return {
    sessionId: input.sessionId,
    query: input.query,
  };
}

function buildFuzzyFileSearchSessionStopOptions(
  input: AgentFuzzyFileSearchSessionStopInput,
): FuzzyFileSearchSessionStopOptions {
  return {
    sessionId: input.sessionId,
  };
}

function buildListExperimentalFeaturesOptions(
  input?: AgentListExperimentalFeaturesInput,
): ListExperimentalFeaturesOptions {
  return {
    ...(input?.limit !== undefined ? { limit: input.limit } : {}),
    ...(input?.cursor !== undefined ? { cursor: input.cursor } : {}),
  };
}

function buildListMcpServerStatusesOptions(
  input?: AgentListMcpServerStatusesInput,
): ListMcpServerStatusesOptions {
  return {
    ...(input?.limit !== undefined ? { limit: input.limit } : {}),
    ...(input?.cursor !== undefined ? { cursor: input.cursor } : {}),
  };
}

function buildListAppsOptions(input?: AgentListAppsInput): ListAppsOptions {
  return {
    ...(input?.limit !== undefined ? { limit: input.limit } : {}),
    ...(input?.cursor !== undefined ? { cursor: input.cursor } : {}),
    ...(input?.threadId !== undefined ? { threadId: input.threadId } : {}),
    ...(input?.forceRefetch !== undefined ? { forceRefetch: input.forceRefetch } : {}),
  };
}

function buildListSkillsOptions(input?: AgentListSkillsInput): ListSkillsOptions {
  return {
    ...(input?.cwds !== undefined ? { cwds: input.cwds } : {}),
    ...(input?.forceReload !== undefined ? { forceReload: input.forceReload } : {}),
    ...(input?.perCwdExtraUserRoots !== undefined
      ? { perCwdExtraUserRoots: input.perCwdExtraUserRoots }
      : {}),
  };
}

export interface CodexThreadManagementOwnerOptions {
  appClient: AppServerClient;
  runAppServerCall: <ValueType>(operation: () => Promise<ValueType>) => Promise<ValueType>;
  ensureCodexAvailable: () => void;
  readProjectedHasUnreadTurnSignal: ReadProjectedHasUnreadTurnSignal;
  isConversationNotFoundError: <ErrorType>(error: ErrorType) => boolean;
  isThreadNotLoadedError: (error: Error) => boolean;
}

/**
 * Owns Codex thread-management calls and maps app-server payload contracts to
 * server-agent contracts consumed by route and adapter owners.
 */
export class CodexThreadManagementOwner {
  private readonly appClient: AppServerClient;
  private readonly runAppServerCall: <ValueType>(
    operation: () => Promise<ValueType>,
  ) => Promise<ValueType>;
  private readonly ensureCodexAvailable: () => void;
  private readonly readProjectedHasUnreadTurnSignal: ReadProjectedHasUnreadTurnSignal;
  private readonly isConversationNotFoundError: <ErrorType>(error: ErrorType) => boolean;
  private readonly isThreadNotLoadedError: (error: Error) => boolean;

  public constructor(options: CodexThreadManagementOwnerOptions) {
    this.appClient = options.appClient;
    this.runAppServerCall = options.runAppServerCall;
    this.ensureCodexAvailable = options.ensureCodexAvailable;
    this.readProjectedHasUnreadTurnSignal = options.readProjectedHasUnreadTurnSignal;
    this.isConversationNotFoundError = options.isConversationNotFoundError;
    this.isThreadNotLoadedError = options.isThreadNotLoadedError;
  }

  public async listThreads(input: AgentListThreadsInput): Promise<AgentListThreadsResult> {
    this.ensureCodexAvailable();

    const result = await this.runAppServerCall(buildListThreadsOperation(this.appClient, input));

    return mapListThreadsResult(result, this.readProjectedHasUnreadTurnSignal);
  }

  public async createThread(input: AgentCreateThreadInput): Promise<AgentCreateThreadResult> {
    this.ensureCodexAvailable();

    const workingDirectory = readRequiredWorkingDirectory(input);

    const result = await this.runAppServerCall(() =>
      this.appClient.startThread(buildStartThreadOptions(input, workingDirectory)),
    );

    return mapCreateThreadResult(result);
  }

  public async readThread(input: AgentReadThreadInput): Promise<AgentReadThreadResult> {
    this.ensureCodexAvailable();
    try {
      const result = await this.runAppServerCall(() =>
        this.appClient.readThread(input.threadId, input.includeTurns),
      );
      return {
        thread: result.thread,
      };
    } catch (error) {
      if (!this.shouldRetryReadThreadAfterResume(error)) {
        throw error;
      }
    }

    await this.runAppServerCall(() =>
      this.appClient.resumeThread(input.threadId, {
        persistExtendedHistory: READ_THREAD_RESUME_WITH_EXTENDED_HISTORY,
      }),
    );
    const result = await this.runAppServerCall(() =>
      this.appClient.readThread(input.threadId, input.includeTurns),
    );
    return {
      thread: result.thread,
    };
  }

  private shouldRetryReadThreadAfterResume<ErrorType>(error: ErrorType): boolean {
    if (this.isConversationNotFoundError(error)) {
      return true;
    }
    if (error instanceof Error) {
      return this.isThreadNotLoadedError(error);
    }
    return false;
  }

  public async listLoadedThreads(): Promise<AgentListLoadedThreadsResult> {
    this.ensureCodexAvailable();

    const loadedThreadIdentifierSet = new Set<string>();
    let cursor: string | null = null;

    for (let pageIndex = 0; pageIndex < LIST_LOADED_THREADS_MAXIMUM_PAGES; pageIndex += 1) {
      const loadedThreadsResult = await this.runAppServerCall(() =>
        this.appClient.listLoadedThreads({
          cursor,
          limit: LIST_LOADED_THREADS_PAGE_LIMIT,
        }),
      );
      mergeLoadedThreadIdentifiers(loadedThreadIdentifierSet, loadedThreadsResult);

      const nextCursor = loadedThreadsResult.nextCursor;
      if (nextCursor === null || nextCursor.length === 0 || nextCursor === cursor) {
        return {
          data: [...loadedThreadIdentifierSet],
          nextCursor: null,
        };
      }

      cursor = nextCursor;
    }

    return {
      data: [...loadedThreadIdentifierSet],
      nextCursor: cursor,
    };
  }

  public async archiveThread(input: AgentArchiveThreadInput): Promise<void> {
    this.ensureCodexAvailable();
    await this.runAppServerCall(() => this.appClient.archiveThread(input.threadId));
  }

  public async forkThread(input: AgentForkThreadInput): Promise<AgentCreateThreadResult> {
    this.ensureCodexAvailable();
    const result = await this.runAppServerCall(() =>
      this.appClient.forkThread(input.threadId, {
        persistExtendedHistory: FORK_WITH_EXTENDED_HISTORY,
      }),
    );

    return mapCreateThreadResult(result);
  }

  public async setThreadName(input: AgentSetThreadNameInput): Promise<void> {
    this.ensureCodexAvailable();
    await this.runAppServerCall(() => this.appClient.setThreadName(input.threadId, input.name));
  }

  public async rollbackThread(input: AgentRollbackThreadInput): Promise<AgentReadThreadResult> {
    this.ensureCodexAvailable();
    const result = await this.runAppServerCall(() =>
      this.appClient.rollbackThread(input.threadId, input.numTurns),
    );
    return {
      thread: result.thread,
    };
  }

  public async compactThread(input: AgentCompactThreadInput): Promise<void> {
    this.ensureCodexAvailable();
    await this.runAppServerCall(() => this.appClient.compactThread(input.threadId));
  }

  public async cleanThreadBackgroundTerminals(
    input: AgentCleanThreadBackgroundTerminalsInput,
  ): Promise<void> {
    this.ensureCodexAvailable();
    await this.runAppServerCall(() =>
      this.appClient.cleanThreadBackgroundTerminals(input.threadId),
    );
  }

  public async unsubscribeThread(
    input: AgentUnsubscribeThreadInput,
  ): Promise<AgentUnsubscribeThreadStatus> {
    this.ensureCodexAvailable();
    return this.runAppServerCall(() => this.appClient.unsubscribeThread(input.threadId));
  }

  public async startThreadReview(
    input: AgentStartThreadReviewInput,
  ): Promise<AgentStartThreadReviewResult> {
    this.ensureCodexAvailable();
    return this.runAppServerCall(() => this.appClient.startReview(buildStartReviewOptions(input)));
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

  public async readConfigRequirements(
    input?: AgentReadConfigRequirementsInput,
  ): Promise<AgentReadConfigRequirementsResult> {
    this.ensureCodexAvailable();
    const result: ReadConfigRequirementsResult = await this.runAppServerCall(() =>
      this.appClient.readConfigRequirements(buildReadConfigRequirementsOptions(input)),
    );
    return result;
  }

  public async listExperimentalFeatures(
    input?: AgentListExperimentalFeaturesInput,
  ): Promise<AgentListExperimentalFeaturesResult> {
    this.ensureCodexAvailable();
    const result: ListExperimentalFeaturesResult = await this.runAppServerCall(() =>
      this.appClient.listExperimentalFeatures(buildListExperimentalFeaturesOptions(input)),
    );
    return result;
  }

  public async listMcpServerStatuses(
    input?: AgentListMcpServerStatusesInput,
  ): Promise<AgentListMcpServerStatusesResult> {
    this.ensureCodexAvailable();
    const result: ListMcpServerStatusesResult = await this.runAppServerCall(() =>
      this.appClient.listMcpServerStatuses(buildListMcpServerStatusesOptions(input)),
    );
    return result;
  }

  public async listApps(input?: AgentListAppsInput): Promise<AgentListAppsResult> {
    this.ensureCodexAvailable();
    const result: ListAppsResult = await this.runAppServerCall(() =>
      this.appClient.listApps(buildListAppsOptions(input)),
    );
    return result;
  }

  public async listSkills(input?: AgentListSkillsInput): Promise<AgentListSkillsResult> {
    this.ensureCodexAvailable();
    const result: ListSkillsResult = await this.runAppServerCall(() =>
      this.appClient.listSkills(buildListSkillsOptions(input)),
    );
    return result;
  }

  public async readAccount(input?: AgentReadAccountInput): Promise<AgentReadAccountResult> {
    this.ensureCodexAvailable();
    const result: ReadAccountResult = await this.runAppServerCall(() =>
      this.appClient.readAccount(buildReadAccountOptions(input)),
    );
    return result;
  }

  public async readAuthStatus(
    input?: AgentReadAuthStatusInput,
  ): Promise<AgentReadAuthStatusResult> {
    this.ensureCodexAvailable();
    const result: ReadAuthStatusResult = await this.runAppServerCall(() =>
      this.appClient.readAuthStatus(buildReadAuthStatusOptions(input)),
    );
    return result;
  }

  public async readAccountRateLimits(
    _input?: AgentReadAccountRateLimitsInput,
  ): Promise<AgentReadAccountRateLimitsResult> {
    this.ensureCodexAvailable();
    const result: ReadAccountRateLimitsResult = await this.runAppServerCall(() =>
      this.appClient.readAccountRateLimits(),
    );
    return result;
  }

  public async readUserInfo(): Promise<AgentReadUserInfoResult> {
    this.ensureCodexAvailable();
    const result: ReadUserInfoResult = await this.runAppServerCall(() =>
      this.appClient.readUserInfo(),
    );
    return result;
  }

  public async uploadFeedback(input: AgentUploadFeedbackInput): Promise<AgentUploadFeedbackResult> {
    this.ensureCodexAvailable();
    const result: FeedbackUploadResult = await this.runAppServerCall(() =>
      this.appClient.uploadFeedback(buildFeedbackUploadOptions(input)),
    );
    return result;
  }

  public async gitDiffToRemote(
    input: AgentGitDiffToRemoteInput,
  ): Promise<AgentGitDiffToRemoteResult> {
    this.ensureCodexAvailable();
    const result: GitDiffToRemoteResult = await this.runAppServerCall(() =>
      this.appClient.gitDiffToRemote(buildGitDiffToRemoteOptions(input)),
    );
    return result;
  }

  public async fuzzyFileSearch(
    input: AgentFuzzyFileSearchInput,
  ): Promise<AgentFuzzyFileSearchResult> {
    this.ensureCodexAvailable();
    const result: FuzzyFileSearchResult = await this.runAppServerCall(() =>
      this.appClient.fuzzyFileSearch(buildFuzzyFileSearchOptions(input)),
    );
    return result;
  }

  public async startFuzzyFileSearchSession(
    input: AgentFuzzyFileSearchSessionStartInput,
  ): Promise<AgentFuzzyFileSearchSessionStartResult> {
    this.ensureCodexAvailable();
    const result: FuzzyFileSearchSessionStartResult = await this.runAppServerCall(() =>
      this.appClient.startFuzzyFileSearchSession(buildFuzzyFileSearchSessionStartOptions(input)),
    );
    return result;
  }

  public async updateFuzzyFileSearchSession(
    input: AgentFuzzyFileSearchSessionUpdateInput,
  ): Promise<AgentFuzzyFileSearchSessionUpdateResult> {
    this.ensureCodexAvailable();
    const result: FuzzyFileSearchSessionUpdateResult = await this.runAppServerCall(() =>
      this.appClient.updateFuzzyFileSearchSession(buildFuzzyFileSearchSessionUpdateOptions(input)),
    );
    return result;
  }

  public async stopFuzzyFileSearchSession(
    input: AgentFuzzyFileSearchSessionStopInput,
  ): Promise<AgentFuzzyFileSearchSessionStopResult> {
    this.ensureCodexAvailable();
    const result: FuzzyFileSearchSessionStopResult = await this.runAppServerCall(() =>
      this.appClient.stopFuzzyFileSearchSession(buildFuzzyFileSearchSessionStopOptions(input)),
    );
    return result;
  }

  public async executeCommand(
    input: AgentCommandExecutionInput,
  ): Promise<AgentCommandExecutionResult> {
    this.ensureCodexAvailable();
    const result: CommandExecutionResult = await this.runAppServerCall(() =>
      this.appClient.executeCommand(buildCommandExecutionOptions(input)),
    );
    return result;
  }

  public async startAccountLogin(
    input: AgentStartAccountLoginInput,
  ): Promise<AgentStartAccountLoginResult> {
    this.ensureCodexAvailable();
    const result: LoginAccountResult = await this.runAppServerCall(() =>
      this.appClient.startAccountLogin(buildStartAccountLoginOptions(input)),
    );
    return result;
  }

  public async cancelAccountLogin(
    input: AgentCancelAccountLoginInput,
  ): Promise<AgentCancelAccountLoginResult> {
    this.ensureCodexAvailable();
    const result: CancelAccountLoginResult = await this.runAppServerCall(() =>
      this.appClient.cancelAccountLogin(buildCancelAccountLoginOptions(input)),
    );
    return result;
  }

  public async logoutAccount(): Promise<void> {
    this.ensureCodexAvailable();
    await this.runAppServerCall(() => this.appClient.logoutAccount());
  }

  public async reloadMcpServerConfig(): Promise<void> {
    this.ensureCodexAvailable();
    await this.runAppServerCall(() => this.appClient.reloadMcpServerConfig());
  }

  public async startMcpServerOauthLogin(
    input: AgentStartMcpServerOauthLoginInput,
  ): Promise<AgentStartMcpServerOauthLoginResult> {
    this.ensureCodexAvailable();
    const result: StartMcpServerOauthLoginResult = await this.runAppServerCall(() =>
      this.appClient.startMcpServerOauthLogin(buildStartMcpServerOauthLoginOptions(input)),
    );
    return result;
  }

  public async writeConfigValue(
    input: AgentWriteConfigValueInput,
  ): Promise<AgentWriteConfigValueResult> {
    this.ensureCodexAvailable();
    const result: ConfigWriteResult = await this.runAppServerCall(() =>
      this.appClient.writeConfigValue(buildWriteConfigValueOptions(input)),
    );
    return result;
  }

  public async writeConfigBatch(
    input: AgentWriteConfigBatchInput,
  ): Promise<AgentWriteConfigValueResult> {
    this.ensureCodexAvailable();
    const result: ConfigWriteResult = await this.runAppServerCall(() =>
      this.appClient.writeConfigBatch(buildWriteConfigBatchOptions(input)),
    );
    return result;
  }

  public async writeSkillsConfig(
    input: AgentWriteSkillsConfigInput,
  ): Promise<AgentWriteSkillsConfigResult> {
    this.ensureCodexAvailable();
    const result: WriteSkillsConfigResult = await this.runAppServerCall(() =>
      this.appClient.writeSkillsConfig(buildWriteSkillsConfigOptions(input)),
    );
    return result;
  }

  public async listRemoteSkills(
    input: AgentListRemoteSkillsInput,
  ): Promise<AgentListRemoteSkillsResult> {
    this.ensureCodexAvailable();
    const result: ListRemoteSkillsResult = await this.runAppServerCall(() =>
      this.appClient.listRemoteSkills(buildListRemoteSkillsOptions(input)),
    );
    return result;
  }

  public async exportRemoteSkill(
    input: AgentExportRemoteSkillInput,
  ): Promise<AgentExportRemoteSkillResult> {
    this.ensureCodexAvailable();
    const result: ExportRemoteSkillResult = await this.runAppServerCall(() =>
      this.appClient.exportRemoteSkill(buildExportRemoteSkillOptions(input)),
    );
    return result;
  }

  public async detectExternalAgentConfig(
    input: AgentDetectExternalAgentConfigInput,
  ): Promise<AgentDetectExternalAgentConfigResult> {
    this.ensureCodexAvailable();
    const result: ExternalAgentConfigDetectResult = await this.runAppServerCall(() =>
      this.appClient.detectExternalAgentConfig(buildExternalAgentConfigDetectOptions(input)),
    );
    return result;
  }

  public async importExternalAgentConfig(
    input: AgentImportExternalAgentConfigInput,
  ): Promise<AgentImportExternalAgentConfigResult> {
    this.ensureCodexAvailable();
    const result: ExternalAgentConfigImportResult = await this.runAppServerCall(() =>
      this.appClient.importExternalAgentConfig(buildExternalAgentConfigImportOptions(input)),
    );
    return result;
  }

  public async startThreadRealtime(
    input: AgentStartThreadRealtimeInput,
  ): Promise<AgentStartThreadRealtimeResult> {
    this.ensureCodexAvailable();
    const result: ThreadRealtimeStartResult = await this.runAppServerCall(() =>
      this.appClient.startThreadRealtime(buildThreadRealtimeStartOptions(input)),
    );
    return result;
  }

  public async appendThreadRealtimeText(
    input: AgentAppendThreadRealtimeTextInput,
  ): Promise<AgentAppendThreadRealtimeTextResult> {
    this.ensureCodexAvailable();
    const result: ThreadRealtimeAppendTextResult = await this.runAppServerCall(() =>
      this.appClient.appendThreadRealtimeText(buildThreadRealtimeAppendTextOptions(input)),
    );
    return result;
  }

  public async appendThreadRealtimeAudio(
    input: AgentAppendThreadRealtimeAudioInput,
  ): Promise<AgentAppendThreadRealtimeAudioResult> {
    this.ensureCodexAvailable();
    const result: ThreadRealtimeAppendAudioResult = await this.runAppServerCall(() =>
      this.appClient.appendThreadRealtimeAudio(buildThreadRealtimeAppendAudioOptions(input)),
    );
    return result;
  }

  public async stopThreadRealtime(
    input: AgentStopThreadRealtimeInput,
  ): Promise<AgentStopThreadRealtimeResult> {
    this.ensureCodexAvailable();
    const result: ThreadRealtimeStopResult = await this.runAppServerCall(() =>
      this.appClient.stopThreadRealtime(buildThreadRealtimeStopOptions(input)),
    );
    return result;
  }

  public async startWindowsSandboxSetup(
    input: AgentStartWindowsSandboxSetupInput,
  ): Promise<AgentStartWindowsSandboxSetupResult> {
    this.ensureCodexAvailable();
    const result: WindowsSandboxSetupStartResult = await this.runAppServerCall(() =>
      this.appClient.startWindowsSandboxSetup(buildWindowsSandboxSetupStartOptions(input)),
    );
    return result;
  }

  public async readConfigDefaults(): Promise<AgentConfigDefaults> {
    this.ensureCodexAvailable();
    const config = await this.runAppServerCall(() =>
      this.appClient.readConfig(READ_CONFIG_DEFAULTS_OPTIONS),
    );
    return mapConfigDefaults(config);
  }
}

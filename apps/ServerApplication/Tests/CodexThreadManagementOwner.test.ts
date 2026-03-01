import {
  AppServerClient,
  type AppServerTransport,
  type CancelAccountLoginOptions,
  type CancelAccountLoginResult,
  type CommandExecutionOptions,
  type CommandExecutionResult,
  type ConfigBatchWriteOptions,
  type ConfigWriteResult,
  type ConfigWriteValueOptions,
  type ExportRemoteSkillOptions,
  type ExportRemoteSkillResult,
  type ExternalAgentConfigDetectOptions,
  type ExternalAgentConfigDetectResult,
  type ExternalAgentConfigImportOptions,
  type ExternalAgentConfigImportResult,
  type FeedbackUploadOptions,
  type FeedbackUploadResult,
  type ForkThreadOptions,
  type FuzzyFileSearchOptions,
  type FuzzyFileSearchResult,
  type GitDiffToRemoteOptions,
  type GitDiffToRemoteResult,
  type ListAppsOptions,
  type ListAppsResult,
  type ListExperimentalFeaturesOptions,
  type ListExperimentalFeaturesResult,
  type ListLoadedThreadsOptions,
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
  type ReadConfigOptions,
  type ReadConfigRequirementsOptions,
  type ReadConfigRequirementsResult,
  type ReadUserInfoResult,
  type StartMcpServerOauthLoginOptions,
  type StartMcpServerOauthLoginResult,
  type StartReviewOptions,
  type StartReviewResult,
  type StartThreadOptions,
  type ThreadRealtimeAppendAudioOptions,
  type ThreadRealtimeAppendAudioResult,
  type ThreadRealtimeAppendTextOptions,
  type ThreadRealtimeAppendTextResult,
  type ThreadRealtimeStartOptions,
  type ThreadRealtimeStartResult,
  type ThreadRealtimeStopOptions,
  type ThreadRealtimeStopResult,
  type UnsubscribeThreadStatus,
  type WindowsSandboxSetupStartOptions,
  type WindowsSandboxSetupStartResult,
  type WriteSkillsConfigOptions,
  type WriteSkillsConfigResult,
} from "@farfield/api";
import type {
  AppServerConfigReadResponse,
  AppServerListThreadsResponse,
  AppServerReadThreadResponse,
  AppServerStartThreadResponse,
  JsonValue,
} from "@farfield/protocol";
import { describe, expect, it } from "vitest";
import { CodexThreadManagementOwner } from "../Source/Agents/Adapters/CodexThreadManagementOwner.js";
import type { AgentCreateThreadInput, AgentListThreadsInput } from "../Source/Agents/Types.js";

const NOOP_TRANSPORT: AppServerTransport = {
  async request(_method: string, _params: object, _timeoutMs?: number): Promise<JsonValue> {
    throw new Error("transport should not be used in this test");
  },
  async close(): Promise<void> {},
};

const EMPTY_LIST_THREADS_RESPONSE: AppServerListThreadsResponse = {
  data: [],
  nextCursor: null,
};

const EMPTY_READ_CONFIG_RESPONSE: AppServerConfigReadResponse = {
  config: {
    profile: null,
    model: null,
    model_reasoning_effort: null,
    profiles: {},
  },
};

const START_THREAD_RESPONSE: AppServerStartThreadResponse = {
  thread: {
    id: "thread-1",
    preview: "Thread preview",
    createdAt: 1,
    updatedAt: 1,
    source: "opencode",
  },
  model: "gpt-5",
  modelProvider: "openai",
  cwd: "/tmp/workspace",
};

class TestAppServerClient extends AppServerClient {
  public readonly listThreadsCalls: ListThreadsOptions[] = [];
  public readonly listThreadsAllCalls: ListThreadsAllOptions[] = [];
  public readonly startThreadCalls: StartThreadOptions[] = [];
  public readonly forkThreadCalls: Array<{ threadId: string; options?: ForkThreadOptions }> = [];
  public readonly setThreadNameCalls: Array<{ threadId: string; name: string }> = [];
  public readonly rollbackThreadCalls: Array<{ threadId: string; numTurns: number }> = [];
  public readonly compactThreadCalls: Array<{ threadId: string }> = [];
  public readonly cleanThreadBackgroundTerminalsCalls: Array<{ threadId: string }> = [];
  public readonly listLoadedThreadsCalls: Array<ListLoadedThreadsOptions | undefined> = [];
  public readonly unsubscribeThreadCalls: Array<{ threadId: string }> = [];
  public readonly startReviewCalls: StartReviewOptions[] = [];
  public readonly readConfigRequirementsCalls: Array<ReadConfigRequirementsOptions | undefined> =
    [];
  public readonly listExperimentalFeaturesCalls: Array<
    ListExperimentalFeaturesOptions | undefined
  > = [];
  public readonly listMcpServerStatusesCalls: Array<ListMcpServerStatusesOptions | undefined> = [];
  public readonly listAppsCalls: Array<ListAppsOptions | undefined> = [];
  public readonly listSkillsCalls: Array<ListSkillsOptions | undefined> = [];
  public readonly listRemoteSkillsCalls: ListRemoteSkillsOptions[] = [];
  public readonly exportRemoteSkillCalls: ExportRemoteSkillOptions[] = [];
  public readonly detectExternalAgentConfigCalls: ExternalAgentConfigDetectOptions[] = [];
  public readonly importExternalAgentConfigCalls: ExternalAgentConfigImportOptions[] = [];
  public readonly startThreadRealtimeCalls: ThreadRealtimeStartOptions[] = [];
  public readonly appendThreadRealtimeAudioCalls: ThreadRealtimeAppendAudioOptions[] = [];
  public readonly appendThreadRealtimeTextCalls: ThreadRealtimeAppendTextOptions[] = [];
  public readonly stopThreadRealtimeCalls: ThreadRealtimeStopOptions[] = [];
  public readonly startWindowsSandboxSetupCalls: WindowsSandboxSetupStartOptions[] = [];
  public readonly readAccountCalls: Array<ReadAccountOptions | undefined> = [];
  public readonly readAuthStatusCalls: Array<ReadAuthStatusOptions | undefined> = [];
  public readonly readAccountRateLimitsCalls: Array<undefined> = [];
  public readonly readUserInfoCalls: Array<undefined> = [];
  public readonly uploadFeedbackCalls: FeedbackUploadOptions[] = [];
  public readonly gitDiffToRemoteCalls: GitDiffToRemoteOptions[] = [];
  public readonly fuzzyFileSearchCalls: FuzzyFileSearchOptions[] = [];
  public readonly executeCommandCalls: CommandExecutionOptions[] = [];
  public readonly startAccountLoginCalls: LoginAccountOptions[] = [];
  public readonly cancelAccountLoginCalls: CancelAccountLoginOptions[] = [];
  public readonly logoutAccountCalls: Array<undefined> = [];
  public readonly reloadMcpServerConfigCalls: Array<undefined> = [];
  public readonly startMcpServerOauthLoginCalls: StartMcpServerOauthLoginOptions[] = [];
  public readonly writeConfigBatchCalls: ConfigBatchWriteOptions[] = [];
  public readonly writeConfigValueCalls: ConfigWriteValueOptions[] = [];
  public readonly writeSkillsConfigCalls: WriteSkillsConfigOptions[] = [];
  public readonly readConfigCalls: Array<ReadConfigOptions | undefined> = [];

  private readonly listThreadsResult: AppServerListThreadsResponse;
  private readonly listThreadsAllResult: AppServerListThreadsResponse;
  private readonly startThreadResult: AppServerStartThreadResponse;
  private readonly rollbackThreadResult: AppServerReadThreadResponse;
  private readonly listLoadedThreadsResult: ListLoadedThreadsResult;
  private readonly unsubscribeThreadResult: UnsubscribeThreadStatus;
  private readonly startReviewResult: StartReviewResult;
  private readonly readConfigRequirementsResult: ReadConfigRequirementsResult;
  private readonly listExperimentalFeaturesResult: ListExperimentalFeaturesResult;
  private readonly listMcpServerStatusesResult: ListMcpServerStatusesResult;
  private readonly listAppsResult: ListAppsResult;
  private readonly listSkillsResult: ListSkillsResult;
  private readonly listRemoteSkillsResult: ListRemoteSkillsResult;
  private readonly exportRemoteSkillResult: ExportRemoteSkillResult;
  private readonly detectExternalAgentConfigResult: ExternalAgentConfigDetectResult;
  private readonly importExternalAgentConfigResult: ExternalAgentConfigImportResult;
  private readonly startThreadRealtimeResult: ThreadRealtimeStartResult;
  private readonly appendThreadRealtimeAudioResult: ThreadRealtimeAppendAudioResult;
  private readonly appendThreadRealtimeTextResult: ThreadRealtimeAppendTextResult;
  private readonly stopThreadRealtimeResult: ThreadRealtimeStopResult;
  private readonly startWindowsSandboxSetupResult: WindowsSandboxSetupStartResult;
  private readonly readAccountResult: ReadAccountResult;
  private readonly readAuthStatusResult: ReadAuthStatusResult;
  private readonly readAccountRateLimitsResult: ReadAccountRateLimitsResult;
  private readonly readUserInfoResult: ReadUserInfoResult;
  private readonly uploadFeedbackResult: FeedbackUploadResult;
  private readonly gitDiffToRemoteResult: GitDiffToRemoteResult;
  private readonly fuzzyFileSearchResult: FuzzyFileSearchResult;
  private readonly executeCommandResult: CommandExecutionResult;
  private readonly startAccountLoginResult: LoginAccountResult;
  private readonly cancelAccountLoginResult: CancelAccountLoginResult;
  private readonly startMcpServerOauthLoginResult: StartMcpServerOauthLoginResult;
  private readonly writeConfigBatchResult: ConfigWriteResult;
  private readonly writeConfigValueResult: ConfigWriteResult;
  private readonly writeSkillsConfigResult: WriteSkillsConfigResult;
  private readonly readConfigResult: AppServerConfigReadResponse;

  public constructor(input?: {
    listThreadsResult?: AppServerListThreadsResponse;
    listThreadsAllResult?: AppServerListThreadsResponse;
    startThreadResult?: AppServerStartThreadResponse;
    rollbackThreadResult?: AppServerReadThreadResponse;
    listLoadedThreadsResult?: ListLoadedThreadsResult;
    unsubscribeThreadResult?: UnsubscribeThreadStatus;
    startReviewResult?: StartReviewResult;
    readConfigRequirementsResult?: ReadConfigRequirementsResult;
    listExperimentalFeaturesResult?: ListExperimentalFeaturesResult;
    listMcpServerStatusesResult?: ListMcpServerStatusesResult;
    listAppsResult?: ListAppsResult;
    listSkillsResult?: ListSkillsResult;
    listRemoteSkillsResult?: ListRemoteSkillsResult;
    exportRemoteSkillResult?: ExportRemoteSkillResult;
    detectExternalAgentConfigResult?: ExternalAgentConfigDetectResult;
    importExternalAgentConfigResult?: ExternalAgentConfigImportResult;
    startThreadRealtimeResult?: ThreadRealtimeStartResult;
    appendThreadRealtimeAudioResult?: ThreadRealtimeAppendAudioResult;
    appendThreadRealtimeTextResult?: ThreadRealtimeAppendTextResult;
    stopThreadRealtimeResult?: ThreadRealtimeStopResult;
    startWindowsSandboxSetupResult?: WindowsSandboxSetupStartResult;
    readAccountResult?: ReadAccountResult;
    readAuthStatusResult?: ReadAuthStatusResult;
    readAccountRateLimitsResult?: ReadAccountRateLimitsResult;
    readUserInfoResult?: ReadUserInfoResult;
    uploadFeedbackResult?: FeedbackUploadResult;
    gitDiffToRemoteResult?: GitDiffToRemoteResult;
    fuzzyFileSearchResult?: FuzzyFileSearchResult;
    executeCommandResult?: CommandExecutionResult;
    startAccountLoginResult?: LoginAccountResult;
    cancelAccountLoginResult?: CancelAccountLoginResult;
    startMcpServerOauthLoginResult?: StartMcpServerOauthLoginResult;
    writeConfigBatchResult?: ConfigWriteResult;
    writeConfigValueResult?: ConfigWriteResult;
    writeSkillsConfigResult?: WriteSkillsConfigResult;
    readConfigResult?: AppServerConfigReadResponse;
  }) {
    super(NOOP_TRANSPORT);
    this.listThreadsResult = input?.listThreadsResult ?? EMPTY_LIST_THREADS_RESPONSE;
    this.listThreadsAllResult = input?.listThreadsAllResult ?? EMPTY_LIST_THREADS_RESPONSE;
    this.startThreadResult = input?.startThreadResult ?? START_THREAD_RESPONSE;
    this.rollbackThreadResult = input?.rollbackThreadResult ?? {
      thread: {
        id: "thread-1",
        turns: [],
        requests: [],
      },
    };
    this.listLoadedThreadsResult = input?.listLoadedThreadsResult ?? {
      data: [],
      nextCursor: null,
    };
    this.unsubscribeThreadResult = input?.unsubscribeThreadResult ?? "notSubscribed";
    this.startReviewResult = input?.startReviewResult ?? {
      reviewThreadId: "thread-1",
      turnId: "turn-review-1",
    };
    this.readConfigRequirementsResult = input?.readConfigRequirementsResult ?? {
      requirements: null,
    };
    this.listExperimentalFeaturesResult = input?.listExperimentalFeaturesResult ?? {
      data: [],
      nextCursor: null,
    };
    this.listMcpServerStatusesResult = input?.listMcpServerStatusesResult ?? {
      data: [],
      nextCursor: null,
    };
    this.listAppsResult = input?.listAppsResult ?? {
      data: [],
      nextCursor: null,
    };
    this.listSkillsResult = input?.listSkillsResult ?? {
      data: [],
    };
    this.listRemoteSkillsResult = input?.listRemoteSkillsResult ?? {
      data: [],
    };
    this.exportRemoteSkillResult = input?.exportRemoteSkillResult ?? {
      id: "remote-skill-1",
      path: "/tmp/workspace/.codex/skills/remote-skill-1/SKILL.md",
    };
    this.detectExternalAgentConfigResult = input?.detectExternalAgentConfigResult ?? {
      items: [],
    };
    this.importExternalAgentConfigResult = input?.importExternalAgentConfigResult ?? {};
    this.startThreadRealtimeResult = input?.startThreadRealtimeResult ?? {};
    this.appendThreadRealtimeAudioResult = input?.appendThreadRealtimeAudioResult ?? {};
    this.appendThreadRealtimeTextResult = input?.appendThreadRealtimeTextResult ?? {};
    this.stopThreadRealtimeResult = input?.stopThreadRealtimeResult ?? {};
    this.startWindowsSandboxSetupResult = input?.startWindowsSandboxSetupResult ?? {
      started: true,
    };
    this.readAccountResult = input?.readAccountResult ?? {
      account: null,
      requiresOpenaiAuth: false,
    };
    this.readAuthStatusResult = input?.readAuthStatusResult ?? {
      authMethod: null,
      authToken: null,
      requiresOpenaiAuth: null,
    };
    this.readAccountRateLimitsResult = input?.readAccountRateLimitsResult ?? {
      rateLimits: {
        credits: null,
        limitId: null,
        limitName: null,
        planType: null,
        primary: null,
        secondary: null,
      },
      rateLimitsByLimitId: null,
    };
    this.readUserInfoResult = input?.readUserInfoResult ?? {
      allegedUserEmail: null,
    };
    this.uploadFeedbackResult = input?.uploadFeedbackResult ?? {
      threadId: "thread-feedback-1",
    };
    this.gitDiffToRemoteResult = input?.gitDiffToRemoteResult ?? {
      sha: "abc123def456",
      diff: "diff --git a/file.ts b/file.ts",
    };
    this.fuzzyFileSearchResult = input?.fuzzyFileSearchResult ?? {
      files: [],
    };
    this.executeCommandResult = input?.executeCommandResult ?? {
      exitCode: 0,
      stdout: "",
      stderr: "",
    };
    this.startAccountLoginResult = input?.startAccountLoginResult ?? {
      type: "chatgpt",
      loginId: "login-1",
      authUrl: "https://example.com/oauth",
    };
    this.cancelAccountLoginResult = input?.cancelAccountLoginResult ?? {
      status: "canceled",
    };
    this.startMcpServerOauthLoginResult = input?.startMcpServerOauthLoginResult ?? {
      authorizationUrl: "https://example.com/oauth/mcp",
    };
    this.writeConfigBatchResult = input?.writeConfigBatchResult ?? {
      status: "ok",
      version: "v1",
      filePath: "/tmp/workspace/.codex/config.toml",
      overriddenMetadata: null,
    };
    this.writeConfigValueResult = input?.writeConfigValueResult ?? {
      status: "ok",
      version: "v1",
      filePath: "/tmp/workspace/.codex/config.toml",
      overriddenMetadata: null,
    };
    this.writeSkillsConfigResult = input?.writeSkillsConfigResult ?? {
      effectiveEnabled: true,
    };
    this.readConfigResult = input?.readConfigResult ?? EMPTY_READ_CONFIG_RESPONSE;
  }

  public override async listThreads(
    options: ListThreadsOptions,
  ): Promise<AppServerListThreadsResponse> {
    this.listThreadsCalls.push(options);
    return this.listThreadsResult;
  }

  public override async listThreadsAll(
    options: ListThreadsAllOptions,
  ): Promise<AppServerListThreadsResponse> {
    this.listThreadsAllCalls.push(options);
    return this.listThreadsAllResult;
  }

  public override async startThread(
    options: StartThreadOptions,
  ): Promise<AppServerStartThreadResponse> {
    this.startThreadCalls.push(options);
    return this.startThreadResult;
  }

  public override async forkThread(
    threadId: string,
    options?: ForkThreadOptions,
  ): Promise<AppServerStartThreadResponse> {
    this.forkThreadCalls.push({
      threadId,
      ...(options !== undefined ? { options } : {}),
    });
    return this.startThreadResult;
  }

  public override async setThreadName(threadId: string, name: string): Promise<void> {
    this.setThreadNameCalls.push({
      threadId,
      name,
    });
  }

  public override async rollbackThread(
    threadId: string,
    numTurns: number,
  ): Promise<AppServerReadThreadResponse> {
    this.rollbackThreadCalls.push({
      threadId,
      numTurns,
    });
    return this.rollbackThreadResult;
  }

  public override async compactThread(threadId: string): Promise<void> {
    this.compactThreadCalls.push({
      threadId,
    });
  }

  public override async cleanThreadBackgroundTerminals(threadId: string): Promise<void> {
    this.cleanThreadBackgroundTerminalsCalls.push({
      threadId,
    });
  }

  public override async listLoadedThreads(
    options?: ListLoadedThreadsOptions,
  ): Promise<ListLoadedThreadsResult> {
    this.listLoadedThreadsCalls.push(options);
    return this.listLoadedThreadsResult;
  }

  public override async unsubscribeThread(threadId: string): Promise<UnsubscribeThreadStatus> {
    this.unsubscribeThreadCalls.push({
      threadId,
    });
    return this.unsubscribeThreadResult;
  }

  public override async startReview(options: StartReviewOptions): Promise<StartReviewResult> {
    this.startReviewCalls.push(options);
    return this.startReviewResult;
  }

  public override async readConfigRequirements(
    options?: ReadConfigRequirementsOptions,
  ): Promise<ReadConfigRequirementsResult> {
    this.readConfigRequirementsCalls.push(options);
    return this.readConfigRequirementsResult;
  }

  public override async listExperimentalFeatures(
    options?: ListExperimentalFeaturesOptions,
  ): Promise<ListExperimentalFeaturesResult> {
    this.listExperimentalFeaturesCalls.push(options);
    return this.listExperimentalFeaturesResult;
  }

  public override async listMcpServerStatuses(
    options?: ListMcpServerStatusesOptions,
  ): Promise<ListMcpServerStatusesResult> {
    this.listMcpServerStatusesCalls.push(options);
    return this.listMcpServerStatusesResult;
  }

  public override async listApps(options?: ListAppsOptions): Promise<ListAppsResult> {
    this.listAppsCalls.push(options);
    return this.listAppsResult;
  }

  public override async listSkills(options?: ListSkillsOptions): Promise<ListSkillsResult> {
    this.listSkillsCalls.push(options);
    return this.listSkillsResult;
  }

  public override async listRemoteSkills(
    options: ListRemoteSkillsOptions,
  ): Promise<ListRemoteSkillsResult> {
    this.listRemoteSkillsCalls.push(options);
    return this.listRemoteSkillsResult;
  }

  public override async exportRemoteSkill(
    options: ExportRemoteSkillOptions,
  ): Promise<ExportRemoteSkillResult> {
    this.exportRemoteSkillCalls.push(options);
    return this.exportRemoteSkillResult;
  }

  public override async detectExternalAgentConfig(
    options: ExternalAgentConfigDetectOptions,
  ): Promise<ExternalAgentConfigDetectResult> {
    this.detectExternalAgentConfigCalls.push(options);
    return this.detectExternalAgentConfigResult;
  }

  public override async importExternalAgentConfig(
    options: ExternalAgentConfigImportOptions,
  ): Promise<ExternalAgentConfigImportResult> {
    this.importExternalAgentConfigCalls.push(options);
    return this.importExternalAgentConfigResult;
  }

  public override async startThreadRealtime(
    options: ThreadRealtimeStartOptions,
  ): Promise<ThreadRealtimeStartResult> {
    this.startThreadRealtimeCalls.push(options);
    return this.startThreadRealtimeResult;
  }

  public override async appendThreadRealtimeText(
    options: ThreadRealtimeAppendTextOptions,
  ): Promise<ThreadRealtimeAppendTextResult> {
    this.appendThreadRealtimeTextCalls.push(options);
    return this.appendThreadRealtimeTextResult;
  }

  public override async appendThreadRealtimeAudio(
    options: ThreadRealtimeAppendAudioOptions,
  ): Promise<ThreadRealtimeAppendAudioResult> {
    this.appendThreadRealtimeAudioCalls.push(options);
    return this.appendThreadRealtimeAudioResult;
  }

  public override async stopThreadRealtime(
    options: ThreadRealtimeStopOptions,
  ): Promise<ThreadRealtimeStopResult> {
    this.stopThreadRealtimeCalls.push(options);
    return this.stopThreadRealtimeResult;
  }

  public override async startWindowsSandboxSetup(
    options: WindowsSandboxSetupStartOptions,
  ): Promise<WindowsSandboxSetupStartResult> {
    this.startWindowsSandboxSetupCalls.push(options);
    return this.startWindowsSandboxSetupResult;
  }

  public override async readAccount(options?: ReadAccountOptions): Promise<ReadAccountResult> {
    this.readAccountCalls.push(options);
    return this.readAccountResult;
  }

  public override async readAuthStatus(
    options?: ReadAuthStatusOptions,
  ): Promise<ReadAuthStatusResult> {
    this.readAuthStatusCalls.push(options);
    return this.readAuthStatusResult;
  }

  public override async readAccountRateLimits(): Promise<ReadAccountRateLimitsResult> {
    this.readAccountRateLimitsCalls.push(undefined);
    return this.readAccountRateLimitsResult;
  }

  public override async readUserInfo(): Promise<ReadUserInfoResult> {
    this.readUserInfoCalls.push(undefined);
    return this.readUserInfoResult;
  }

  public override async uploadFeedback(
    options: FeedbackUploadOptions,
  ): Promise<FeedbackUploadResult> {
    this.uploadFeedbackCalls.push(options);
    return this.uploadFeedbackResult;
  }

  public override async gitDiffToRemote(
    options: GitDiffToRemoteOptions,
  ): Promise<GitDiffToRemoteResult> {
    this.gitDiffToRemoteCalls.push(options);
    return this.gitDiffToRemoteResult;
  }

  public override async fuzzyFileSearch(
    options: FuzzyFileSearchOptions,
  ): Promise<FuzzyFileSearchResult> {
    this.fuzzyFileSearchCalls.push(options);
    return this.fuzzyFileSearchResult;
  }

  public override async executeCommand(
    options: CommandExecutionOptions,
  ): Promise<CommandExecutionResult> {
    this.executeCommandCalls.push(options);
    return this.executeCommandResult;
  }

  public override async startAccountLogin(
    options: LoginAccountOptions,
  ): Promise<LoginAccountResult> {
    this.startAccountLoginCalls.push(options);
    return this.startAccountLoginResult;
  }

  public override async cancelAccountLogin(
    options: CancelAccountLoginOptions,
  ): Promise<CancelAccountLoginResult> {
    this.cancelAccountLoginCalls.push(options);
    return this.cancelAccountLoginResult;
  }

  public override async logoutAccount(): Promise<void> {
    this.logoutAccountCalls.push(undefined);
  }

  public override async reloadMcpServerConfig(): Promise<void> {
    this.reloadMcpServerConfigCalls.push(undefined);
  }

  public override async startMcpServerOauthLogin(
    options: StartMcpServerOauthLoginOptions,
  ): Promise<StartMcpServerOauthLoginResult> {
    this.startMcpServerOauthLoginCalls.push(options);
    return this.startMcpServerOauthLoginResult;
  }

  public override async writeConfigValue(
    options: ConfigWriteValueOptions,
  ): Promise<ConfigWriteResult> {
    this.writeConfigValueCalls.push(options);
    return this.writeConfigValueResult;
  }

  public override async writeConfigBatch(
    options: ConfigBatchWriteOptions,
  ): Promise<ConfigWriteResult> {
    this.writeConfigBatchCalls.push(options);
    return this.writeConfigBatchResult;
  }

  public override async writeSkillsConfig(
    options: WriteSkillsConfigOptions,
  ): Promise<WriteSkillsConfigResult> {
    this.writeSkillsConfigCalls.push(options);
    return this.writeSkillsConfigResult;
  }

  public override async readConfig(
    options?: ReadConfigOptions,
  ): Promise<AppServerConfigReadResponse> {
    this.readConfigCalls.push(options);
    return this.readConfigResult;
  }
}

function createOwner(
  appClient: AppServerClient,
  readProjectedHasUnreadTurnSignal: (threadId: string) => boolean | null = () => null,
): CodexThreadManagementOwner {
  return new CodexThreadManagementOwner({
    appClient,
    runAppServerCall: async <ValueType>(operation: () => Promise<ValueType>): Promise<ValueType> =>
      operation(),
    ensureCodexAvailable: () => {},
    readProjectedHasUnreadTurnSignal,
  });
}

interface AgentListThreadsInputOverrides {
  limit?: AgentListThreadsInput["limit"];
  archived?: AgentListThreadsInput["archived"];
  all?: AgentListThreadsInput["all"];
  maxPages?: AgentListThreadsInput["maxPages"];
  cursor?: AgentListThreadsInput["cursor"];
  sortKey?: AgentListThreadsInput["sortKey"];
  cwd?: AgentListThreadsInput["cwd"];
}

function createListThreadsInput(
  overrides: AgentListThreadsInputOverrides = {},
): AgentListThreadsInput {
  return {
    limit: 20,
    archived: false,
    all: false,
    maxPages: 1,
    cursor: null,
    sortKey: "updated_at",
    cwd: null,
    ...overrides,
  };
}

describe("CodexThreadManagementOwner", () => {
  it("maps single-page list request options and omits optional fields when absent", async () => {
    const appClient = new TestAppServerClient({
      listThreadsResult: {
        data: [],
        nextCursor: "next-cursor",
      },
    });
    const owner = createOwner(appClient);

    const result = await owner.listThreads(
      createListThreadsInput({
        all: false,
        limit: 10,
        archived: true,
        sortKey: "created_at",
      }),
    );

    expect(appClient.listThreadsCalls).toEqual([
      {
        limit: 10,
        archived: true,
        sortKey: "created_at",
      },
    ]);
    expect(result).toEqual({
      data: [],
      nextCursor: "next-cursor",
    });
    expect(result).not.toHaveProperty("pages");
    expect(result).not.toHaveProperty("truncated");
  });

  it("applies projected unread signals to list-thread items when available", async () => {
    const appClient = new TestAppServerClient({
      listThreadsResult: {
        data: [
          {
            id: "thread-1",
            preview: "Thread one",
            createdAt: 1,
            updatedAt: 2,
            source: "opencode",
          },
          {
            id: "thread-2",
            preview: "Thread two",
            createdAt: 3,
            updatedAt: 4,
            source: "opencode",
            hasUnreadTurn: true,
          },
        ],
        nextCursor: null,
      },
    });
    const owner = createOwner(appClient, (threadId) => {
      if (threadId === "thread-1") {
        return false;
      }
      return null;
    });

    const result = await owner.listThreads(createListThreadsInput());

    expect(result.data).toEqual([
      {
        id: "thread-1",
        preview: "Thread one",
        createdAt: 1,
        updatedAt: 2,
        source: "opencode",
        hasUnreadTurn: false,
      },
      {
        id: "thread-2",
        preview: "Thread two",
        createdAt: 3,
        updatedAt: 4,
        source: "opencode",
        hasUnreadTurn: true,
      },
    ]);
  });

  it("preserves explicit empty-string list-thread optional values", async () => {
    const appClient = new TestAppServerClient();
    const owner = createOwner(appClient);

    await owner.listThreads(
      createListThreadsInput({
        cursor: "",
        cwd: "",
      }),
    );

    expect(appClient.listThreadsCalls).toEqual([
      {
        limit: 20,
        archived: false,
        cursor: "",
        sortKey: "updated_at",
        cwd: "",
      },
    ]);
  });

  it("maps all-pages list request options and preserves optional pagination metadata", async () => {
    const appClient = new TestAppServerClient({
      listThreadsAllResult: {
        data: [],
        nextCursor: null,
        pages: 2,
        truncated: true,
      },
    });
    const owner = createOwner(appClient);

    const result = await owner.listThreads(
      createListThreadsInput({
        all: true,
        cursor: "cursor-1",
        cwd: "/tmp/workspace",
        maxPages: 3,
      }),
    );

    expect(appClient.listThreadsAllCalls).toEqual([
      {
        limit: 20,
        archived: false,
        cursor: "cursor-1",
        sortKey: "updated_at",
        cwd: "/tmp/workspace",
        maxPages: 3,
      },
    ]);
    expect(result).toEqual({
      data: [],
      nextCursor: null,
      pages: 2,
      truncated: true,
    });
  });

  it("normalizes undefined nextCursor to null for list results", async () => {
    const appClient = new TestAppServerClient({
      listThreadsResult: {
        data: [],
      },
    });
    const owner = createOwner(appClient);

    const result = await owner.listThreads(createListThreadsInput());

    expect(result).toEqual({
      data: [],
      nextCursor: null,
    });
  });

  it("rejects create-thread requests when cwd is missing or blank", async () => {
    const owner = createOwner(new TestAppServerClient());

    await expect(owner.createThread({})).rejects.toThrowError(/requires cwd/);
    await expect(owner.createThread({ cwd: "   " })).rejects.toThrowError(/requires cwd/);
  });

  it("trims cwd before thread creation and forwards optional start-thread options", async () => {
    const appClient = new TestAppServerClient();
    const owner = createOwner(appClient);
    const createThreadInput: AgentCreateThreadInput = {
      cwd: "  /tmp/workspace  ",
      model: "gpt-5",
      modelProvider: "openai",
      approvalPolicy: "on-request",
      sandbox: "workspace-write",
      ephemeral: true,
    };

    const result = await owner.createThread(createThreadInput);

    expect(appClient.startThreadCalls).toEqual([
      {
        cwd: "/tmp/workspace",
        model: "gpt-5",
        modelProvider: "openai",
        approvalPolicy: "on-request",
        sandbox: "workspace-write",
        ephemeral: true,
      },
    ]);
    expect(result.threadId).toBe("thread-1");
    expect(result.cwd).toBe("/tmp/workspace");
  });

  it("preserves explicit empty-string optional create-thread values", async () => {
    const appClient = new TestAppServerClient();
    const owner = createOwner(appClient);

    await owner.createThread({
      cwd: "  /tmp/workspace  ",
      model: "",
      modelProvider: "",
      personality: "",
      sandbox: "",
      approvalPolicy: "",
      ephemeral: false,
    });

    expect(appClient.startThreadCalls).toEqual([
      {
        cwd: "/tmp/workspace",
        model: "",
        modelProvider: "",
        personality: "",
        sandbox: "",
        approvalPolicy: "",
        ephemeral: false,
      },
    ]);
  });

  it("maps create-thread response contract metadata", async () => {
    const appClient = new TestAppServerClient({
      startThreadResult: {
        ...START_THREAD_RESPONSE,
        model: "gpt-5",
        modelProvider: "openai",
        cwd: "/tmp/workspace",
        approvalPolicy: "never",
        sandbox: "workspace-write",
        reasoningEffort: "medium",
      },
    });
    const owner = createOwner(appClient);

    const result = await owner.createThread({ cwd: "/tmp/workspace" });

    expect(result).toEqual({
      threadId: "thread-1",
      thread: START_THREAD_RESPONSE.thread,
      model: "gpt-5",
      modelProvider: "openai",
      cwd: "/tmp/workspace",
      approvalPolicy: "never",
      sandbox: "workspace-write",
      reasoningEffort: "medium",
    });
  });

  it("forks a thread with extended-history persistence and maps create-thread metadata", async () => {
    const appClient = new TestAppServerClient();
    const owner = createOwner(appClient);

    const result = await owner.forkThread({
      threadId: "thread-9",
    });

    expect(appClient.forkThreadCalls).toEqual([
      {
        threadId: "thread-9",
        options: {
          persistExtendedHistory: true,
        },
      },
    ]);
    expect(result.threadId).toBe("thread-1");
  });

  it("sets thread name using the codex management owner", async () => {
    const appClient = new TestAppServerClient();
    const owner = createOwner(appClient);

    await owner.setThreadName({
      threadId: "thread-7",
      name: "new-name",
    });

    expect(appClient.setThreadNameCalls).toEqual([
      {
        threadId: "thread-7",
        name: "new-name",
      },
    ]);
  });

  it("rolls back thread turns through codex management owner", async () => {
    const appClient = new TestAppServerClient({
      rollbackThreadResult: {
        thread: {
          id: "thread-7",
          turns: [],
          requests: [],
        },
      },
    });
    const owner = createOwner(appClient);

    const result = await owner.rollbackThread({
      threadId: "thread-7",
      numTurns: 2,
    });

    expect(appClient.rollbackThreadCalls).toEqual([
      {
        threadId: "thread-7",
        numTurns: 2,
      },
    ]);
    expect(result).toEqual({
      thread: {
        id: "thread-7",
        turns: [],
        requests: [],
      },
    });
  });

  it("starts thread compaction through codex management owner", async () => {
    const appClient = new TestAppServerClient();
    const owner = createOwner(appClient);

    await owner.compactThread({
      threadId: "thread-compact-7",
    });

    expect(appClient.compactThreadCalls).toEqual([
      {
        threadId: "thread-compact-7",
      },
    ]);
  });

  it("cleans background terminals through codex management owner", async () => {
    const appClient = new TestAppServerClient();
    const owner = createOwner(appClient);

    await owner.cleanThreadBackgroundTerminals({
      threadId: "thread-clean-7",
    });

    expect(appClient.cleanThreadBackgroundTerminalsCalls).toEqual([
      {
        threadId: "thread-clean-7",
      },
    ]);
  });

  it("lists loaded threads with bounded pagination through codex management owner", async () => {
    const appClient = new TestAppServerClient({
      listLoadedThreadsResult: {
        data: ["thread-loaded-1", "thread-loaded-2"],
        nextCursor: null,
      },
    });
    const owner = createOwner(appClient);

    const result = await owner.listLoadedThreads();

    expect(appClient.listLoadedThreadsCalls).toEqual([
      {
        cursor: null,
        limit: 200,
      },
    ]);
    expect(result).toEqual({
      data: ["thread-loaded-1", "thread-loaded-2"],
      nextCursor: null,
    });
  });

  it("unsubscribes threads through codex management owner", async () => {
    const appClient = new TestAppServerClient({
      unsubscribeThreadResult: "unsubscribed",
    });
    const owner = createOwner(appClient);

    const result = await owner.unsubscribeThread({
      threadId: "thread-sub-7",
    });

    expect(appClient.unsubscribeThreadCalls).toEqual([
      {
        threadId: "thread-sub-7",
      },
    ]);
    expect(result).toBe("unsubscribed");
  });

  it("starts thread review with strict target and delivery contracts", async () => {
    const appClient = new TestAppServerClient({
      startReviewResult: {
        reviewThreadId: "thread-review-9",
        turnId: "turn-review-9",
      },
    });
    const owner = createOwner(appClient);

    const result = await owner.startThreadReview({
      threadId: "thread-7",
      target: {
        type: "custom",
        instructions: "Review performance-sensitive reducer changes.",
      },
      delivery: "detached",
    });

    expect(appClient.startReviewCalls).toEqual([
      {
        threadId: "thread-7",
        target: {
          type: "custom",
          instructions: "Review performance-sensitive reducer changes.",
        },
        delivery: "detached",
      },
    ]);
    expect(result).toEqual({
      reviewThreadId: "thread-review-9",
      turnId: "turn-review-9",
    });
  });

  it("reads config requirements through codex management owner", async () => {
    const appClient = new TestAppServerClient({
      readConfigRequirementsResult: {
        requirements: {
          allowedApprovalPolicies: ["on-request"],
          allowedSandboxModes: ["workspace-write"],
          allowedWebSearchModes: ["on"],
          enforceResidency: "us",
          network: {
            enabled: true,
            httpPort: 8080,
            socksPort: null,
            allowUpstreamProxy: false,
            dangerouslyAllowNonLoopbackProxy: false,
            dangerouslyAllowNonLoopbackAdmin: false,
            dangerouslyAllowAllUnixSockets: false,
            allowedDomains: ["example.com"],
            deniedDomains: null,
            allowUnixSockets: null,
            allowLocalBinding: true,
          },
        },
      },
    });
    const owner = createOwner(appClient);

    const result = await owner.readConfigRequirements();

    expect(appClient.readConfigRequirementsCalls).toEqual([{}]);
    expect(result.requirements?.allowedApprovalPolicies).toEqual(["on-request"]);
  });

  it("lists experimental features through codex management owner", async () => {
    const appClient = new TestAppServerClient({
      listExperimentalFeaturesResult: {
        data: [
          {
            name: "advanced-diff-view",
            stage: "beta",
            displayName: "Advanced Diff View",
            description: "Detailed diff review controls",
            announcement: null,
            enabled: true,
            defaultEnabled: false,
          },
        ],
        nextCursor: null,
      },
    });
    const owner = createOwner(appClient);

    const result = await owner.listExperimentalFeatures({
      cursor: null,
      limit: 30,
    });

    expect(appClient.listExperimentalFeaturesCalls).toEqual([
      {
        cursor: null,
        limit: 30,
      },
    ]);
    expect(result.data).toHaveLength(1);
  });

  it("lists mcp server statuses through codex management owner", async () => {
    const appClient = new TestAppServerClient({
      listMcpServerStatusesResult: {
        data: [
          {
            name: "github",
            authStatus: "authenticated",
            toolCount: 4,
            resourceCount: 2,
            resourceTemplateCount: 1,
          },
        ],
        nextCursor: null,
      },
    });
    const owner = createOwner(appClient);

    const result = await owner.listMcpServerStatuses({
      limit: 50,
    });

    expect(appClient.listMcpServerStatusesCalls).toEqual([
      {
        limit: 50,
      },
    ]);
    expect(result.data[0]?.toolCount).toBe(4);
  });

  it("lists apps through codex management owner", async () => {
    const appClient = new TestAppServerClient({
      listAppsResult: {
        data: [
          {
            id: "app-github",
            name: "GitHub",
            description: "GitHub connector",
            logoUrl: null,
            logoUrlDark: null,
            installUrl: "https://example.com/install",
            isAccessible: true,
            isEnabled: true,
          },
        ],
        nextCursor: null,
      },
    });
    const owner = createOwner(appClient);

    const result = await owner.listApps({
      forceRefetch: true,
      threadId: "thread-7",
    });

    expect(appClient.listAppsCalls).toEqual([
      {
        forceRefetch: true,
        threadId: "thread-7",
      },
    ]);
    expect(result.data[0]?.id).toBe("app-github");
  });

  it("lists skills through codex management owner", async () => {
    const appClient = new TestAppServerClient({
      listSkillsResult: {
        data: [
          {
            cwd: "/tmp/workspace",
            skills: [
              {
                name: "checks",
                description: "Run repository checks",
                shortDescription: "Checks",
                path: "/tmp/workspace/.codex/skills/checks/SKILL.md",
                scope: "repo",
                enabled: true,
              },
            ],
            errors: [],
          },
        ],
      },
    });
    const owner = createOwner(appClient);

    const result = await owner.listSkills({
      cwds: ["/tmp/workspace"],
      forceReload: true,
    });

    expect(appClient.listSkillsCalls).toEqual([
      {
        cwds: ["/tmp/workspace"],
        forceReload: true,
      },
    ]);
    expect(result.data[0]?.skills[0]?.name).toBe("checks");
  });

  it("reads account details through codex management owner", async () => {
    const appClient = new TestAppServerClient({
      readAccountResult: {
        account: {
          type: "chatgpt",
          email: "dev@example.com",
          planType: "pro",
        },
        requiresOpenaiAuth: false,
      },
    });
    const owner = createOwner(appClient);

    const result = await owner.readAccount({
      refreshToken: true,
    });

    expect(appClient.readAccountCalls).toEqual([
      {
        refreshToken: true,
      },
    ]);
    expect(result.account?.type).toBe("chatgpt");
  });

  it("reads auth status through codex management owner", async () => {
    const appClient = new TestAppServerClient({
      readAuthStatusResult: {
        authMethod: "chatgpt",
        authToken: null,
        requiresOpenaiAuth: true,
      },
    });
    const owner = createOwner(appClient);

    const result = await owner.readAuthStatus({
      includeToken: true,
      refreshToken: false,
    });

    expect(appClient.readAuthStatusCalls).toEqual([
      {
        includeToken: true,
        refreshToken: false,
      },
    ]);
    expect(result).toEqual({
      authMethod: "chatgpt",
      authToken: null,
      requiresOpenaiAuth: true,
    });
  });

  it("reads account rate limits through codex management owner", async () => {
    const appClient = new TestAppServerClient({
      readAccountRateLimitsResult: {
        rateLimits: {
          credits: null,
          limitId: "codex",
          limitName: "Codex",
          planType: "pro",
          primary: {
            usedPercent: 42,
            resetsAt: 1_700_000_000,
            windowDurationMins: 60,
          },
          secondary: null,
        },
        rateLimitsByLimitId: null,
      },
    });
    const owner = createOwner(appClient);

    const result = await owner.readAccountRateLimits();

    expect(appClient.readAccountRateLimitsCalls).toEqual([undefined]);
    expect(result.rateLimits.limitId).toBe("codex");
  });

  it("reads user info through codex management owner", async () => {
    const appClient = new TestAppServerClient({
      readUserInfoResult: {
        allegedUserEmail: "dev@example.com",
      },
    });
    const owner = createOwner(appClient);

    const result = await owner.readUserInfo();

    expect(appClient.readUserInfoCalls).toEqual([undefined]);
    expect(result).toEqual({
      allegedUserEmail: "dev@example.com",
    });
  });

  it("starts chatgpt account login through codex management owner", async () => {
    const appClient = new TestAppServerClient({
      startAccountLoginResult: {
        type: "chatgpt",
        loginId: "login-9",
        authUrl: "https://example.com/oauth/start",
      },
    });
    const owner = createOwner(appClient);

    const result = await owner.startAccountLogin({
      type: "chatgpt",
    });

    expect(appClient.startAccountLoginCalls).toEqual([
      {
        type: "chatgpt",
      },
    ]);
    expect(result).toEqual({
      type: "chatgpt",
      loginId: "login-9",
      authUrl: "https://example.com/oauth/start",
    });
  });

  it("executes commands through codex management owner", async () => {
    const appClient = new TestAppServerClient({
      executeCommandResult: {
        exitCode: 0,
        stdout: "/tmp/workspace\n",
        stderr: "",
      },
    });
    const owner = createOwner(appClient);

    const result = await owner.executeCommand({
      command: ["pwd", "-P"],
      timeoutMilliseconds: 3_000,
      cwd: "/tmp/workspace",
    });

    expect(appClient.executeCommandCalls).toEqual([
      {
        command: ["pwd", "-P"],
        timeoutMilliseconds: 3_000,
        cwd: "/tmp/workspace",
      },
    ]);
    expect(result).toEqual({
      exitCode: 0,
      stdout: "/tmp/workspace\n",
      stderr: "",
    });
  });

  it("reads git diff to remote through codex management owner", async () => {
    const appClient = new TestAppServerClient({
      gitDiffToRemoteResult: {
        sha: "abc123def456",
        diff: "diff --git a/file.ts b/file.ts",
      },
    });
    const owner = createOwner(appClient);

    const result = await owner.gitDiffToRemote({
      cwd: "/tmp/workspace",
    });

    expect(appClient.gitDiffToRemoteCalls).toEqual([
      {
        cwd: "/tmp/workspace",
      },
    ]);
    expect(result).toEqual({
      sha: "abc123def456",
      diff: "diff --git a/file.ts b/file.ts",
    });
  });

  it("searches fuzzy files through codex management owner", async () => {
    const appClient = new TestAppServerClient({
      fuzzyFileSearchResult: {
        files: [
          {
            root: "/tmp/workspace",
            path: "apps/WebApplication/Source/Main.tsx",
            fileName: "Main.tsx",
            score: 0.94,
            indices: [0, 1, 2],
          },
        ],
      },
    });
    const owner = createOwner(appClient);

    const result = await owner.fuzzyFileSearch({
      query: "main",
      roots: ["/tmp/workspace", "/tmp/workspace/packages"],
      cancellationToken: "token-1",
    });

    expect(appClient.fuzzyFileSearchCalls).toEqual([
      {
        query: "main",
        roots: ["/tmp/workspace", "/tmp/workspace/packages"],
        cancellationToken: "token-1",
      },
    ]);
    expect(result).toEqual({
      files: [
        {
          root: "/tmp/workspace",
          path: "apps/WebApplication/Source/Main.tsx",
          fileName: "Main.tsx",
          score: 0.94,
          indices: [0, 1, 2],
        },
      ],
    });
  });

  it("uploads feedback through codex management owner", async () => {
    const appClient = new TestAppServerClient({
      uploadFeedbackResult: {
        threadId: "thread-feedback-9",
      },
    });
    const owner = createOwner(appClient);

    const result = await owner.uploadFeedback({
      classification: "quality",
      reason: "The generated answer omitted key acceptance criteria.",
      includeLogs: true,
      threadId: "thread-1",
    });

    expect(appClient.uploadFeedbackCalls).toEqual([
      {
        classification: "quality",
        reason: "The generated answer omitted key acceptance criteria.",
        includeLogs: true,
        threadId: "thread-1",
      },
    ]);
    expect(result).toEqual({
      threadId: "thread-feedback-9",
    });
  });

  it("cancels account login through codex management owner", async () => {
    const appClient = new TestAppServerClient({
      cancelAccountLoginResult: {
        status: "canceled",
      },
    });
    const owner = createOwner(appClient);

    const result = await owner.cancelAccountLogin({
      loginId: "login-9",
    });

    expect(appClient.cancelAccountLoginCalls).toEqual([
      {
        loginId: "login-9",
      },
    ]);
    expect(result).toEqual({
      status: "canceled",
    });
  });

  it("logs out account through codex management owner", async () => {
    const appClient = new TestAppServerClient();
    const owner = createOwner(appClient);

    await owner.logoutAccount();

    expect(appClient.logoutAccountCalls).toEqual([undefined]);
  });

  it("reloads mcp server config through codex management owner", async () => {
    const appClient = new TestAppServerClient();
    const owner = createOwner(appClient);

    await owner.reloadMcpServerConfig();

    expect(appClient.reloadMcpServerConfigCalls).toEqual([undefined]);
  });

  it("starts mcp oauth login through codex management owner", async () => {
    const appClient = new TestAppServerClient({
      startMcpServerOauthLoginResult: {
        authorizationUrl: "https://example.com/oauth/github",
      },
    });
    const owner = createOwner(appClient);

    const result = await owner.startMcpServerOauthLogin({
      name: "github",
      scopes: ["read:org"],
      timeoutSeconds: 90,
    });

    expect(appClient.startMcpServerOauthLoginCalls).toEqual([
      {
        name: "github",
        scopes: ["read:org"],
        timeoutSeconds: 90,
      },
    ]);
    expect(result.authorizationUrl).toBe("https://example.com/oauth/github");
  });

  it("writes config batches through codex management owner", async () => {
    const appClient = new TestAppServerClient({
      writeConfigBatchResult: {
        status: "ok",
        version: "v8",
        filePath: "/tmp/workspace/.codex/config.toml",
        overriddenMetadata: null,
      },
    });
    const owner = createOwner(appClient);

    const result = await owner.writeConfigBatch({
      edits: [
        {
          keyPath: "integrations.github.enabled",
          value: true,
          mergeStrategy: "replace",
        },
        {
          keyPath: "integrations.github.scopes",
          value: ["repo", "read:org"],
          mergeStrategy: "upsert",
        },
      ],
      filePath: "/tmp/workspace/.codex/config.toml",
      expectedVersion: "v7",
    });

    expect(appClient.writeConfigBatchCalls).toEqual([
      {
        edits: [
          {
            keyPath: "integrations.github.enabled",
            value: true,
            mergeStrategy: "replace",
          },
          {
            keyPath: "integrations.github.scopes",
            value: ["repo", "read:org"],
            mergeStrategy: "upsert",
          },
        ],
        filePath: "/tmp/workspace/.codex/config.toml",
        expectedVersion: "v7",
      },
    ]);
    expect(result).toEqual({
      status: "ok",
      version: "v8",
      filePath: "/tmp/workspace/.codex/config.toml",
      overriddenMetadata: null,
    });
  });

  it("writes config values through codex management owner", async () => {
    const appClient = new TestAppServerClient({
      writeConfigValueResult: {
        status: "okOverridden",
        version: "v4",
        filePath: "/tmp/workspace/.codex/config.toml",
        overriddenMetadata: {
          message: "Workspace config value overrides parent config.",
          overridingLayer: "workspace",
          effectiveValue: {
            enabled: true,
          },
        },
      },
    });
    const owner = createOwner(appClient);

    const result = await owner.writeConfigValue({
      keyPath: "integrations.github",
      value: {
        enabled: true,
      },
      mergeStrategy: "upsert",
      filePath: "/tmp/workspace/.codex/config.toml",
      expectedVersion: "v3",
    });

    expect(appClient.writeConfigValueCalls).toEqual([
      {
        keyPath: "integrations.github",
        value: {
          enabled: true,
        },
        mergeStrategy: "upsert",
        filePath: "/tmp/workspace/.codex/config.toml",
        expectedVersion: "v3",
      },
    ]);
    expect(result).toEqual({
      status: "okOverridden",
      version: "v4",
      filePath: "/tmp/workspace/.codex/config.toml",
      overriddenMetadata: {
        message: "Workspace config value overrides parent config.",
        overridingLayer: "workspace",
        effectiveValue: {
          enabled: true,
        },
      },
    });
  });

  it("writes skills config through codex management owner", async () => {
    const appClient = new TestAppServerClient({
      writeSkillsConfigResult: {
        effectiveEnabled: false,
      },
    });
    const owner = createOwner(appClient);

    const result = await owner.writeSkillsConfig({
      path: "/tmp/workspace/.codex/skills/checks/SKILL.md",
      enabled: false,
    });

    expect(appClient.writeSkillsConfigCalls).toEqual([
      {
        path: "/tmp/workspace/.codex/skills/checks/SKILL.md",
        enabled: false,
      },
    ]);
    expect(result.effectiveEnabled).toBe(false);
  });

  it("lists remote skills through codex management owner", async () => {
    const appClient = new TestAppServerClient({
      listRemoteSkillsResult: {
        data: [
          {
            id: "remote-skill-1",
            name: "Repository checks",
            description: "Run repository checks",
          },
        ],
      },
    });
    const owner = createOwner(appClient);

    const result = await owner.listRemoteSkills({
      hazelnutScope: "personal",
      productSurface: "codex",
      enabled: true,
    });

    expect(appClient.listRemoteSkillsCalls).toEqual([
      {
        hazelnutScope: "personal",
        productSurface: "codex",
        enabled: true,
      },
    ]);
    expect(result).toEqual({
      data: [
        {
          id: "remote-skill-1",
          name: "Repository checks",
          description: "Run repository checks",
        },
      ],
    });
  });

  it("exports remote skill through codex management owner", async () => {
    const appClient = new TestAppServerClient({
      exportRemoteSkillResult: {
        id: "remote-skill-1",
        path: "/tmp/workspace/.codex/skills/repository-checks/SKILL.md",
      },
    });
    const owner = createOwner(appClient);

    const result = await owner.exportRemoteSkill({
      hazelnutId: "remote-skill-1",
    });

    expect(appClient.exportRemoteSkillCalls).toEqual([
      {
        hazelnutId: "remote-skill-1",
      },
    ]);
    expect(result).toEqual({
      id: "remote-skill-1",
      path: "/tmp/workspace/.codex/skills/repository-checks/SKILL.md",
    });
  });

  it("detects external-agent config migration items through codex management owner", async () => {
    const appClient = new TestAppServerClient({
      detectExternalAgentConfigResult: {
        items: [
          {
            itemType: "AGENTS_MD",
            description: "Migrate AGENTS.md from ~/.claude",
            cwd: null,
          },
          {
            itemType: "CONFIG",
            description: "Import repository config",
            cwd: "/tmp/workspace",
          },
        ],
      },
    });
    const owner = createOwner(appClient);

    const result = await owner.detectExternalAgentConfig({
      includeHome: true,
      cwds: ["/tmp/workspace"],
    });

    expect(appClient.detectExternalAgentConfigCalls).toEqual([
      {
        includeHome: true,
        cwds: ["/tmp/workspace"],
      },
    ]);
    expect(result).toEqual({
      items: [
        {
          itemType: "AGENTS_MD",
          description: "Migrate AGENTS.md from ~/.claude",
          cwd: null,
        },
        {
          itemType: "CONFIG",
          description: "Import repository config",
          cwd: "/tmp/workspace",
        },
      ],
    });
  });

  it("imports external-agent config migration items through codex management owner", async () => {
    const appClient = new TestAppServerClient();
    const owner = createOwner(appClient);

    const result = await owner.importExternalAgentConfig({
      migrationItems: [
        {
          itemType: "AGENTS_MD",
          description: "Migrate AGENTS.md from ~/.claude",
          cwd: null,
        },
        {
          itemType: "CONFIG",
          description: "Import repository config",
          cwd: "/tmp/workspace",
        },
      ],
    });

    expect(appClient.importExternalAgentConfigCalls).toEqual([
      {
        migrationItems: [
          {
            itemType: "AGENTS_MD",
            description: "Migrate AGENTS.md from ~/.claude",
            cwd: null,
          },
          {
            itemType: "CONFIG",
            description: "Import repository config",
            cwd: "/tmp/workspace",
          },
        ],
      },
    ]);
    expect(result).toEqual({});
  });

  it("starts thread realtime through codex management owner", async () => {
    const appClient = new TestAppServerClient();
    const owner = createOwner(appClient);

    const result = await owner.startThreadRealtime({
      threadId: "thread-1",
      prompt: "Summarize this repository.",
      sessionId: "session-1",
    });

    expect(appClient.startThreadRealtimeCalls).toEqual([
      {
        threadId: "thread-1",
        prompt: "Summarize this repository.",
        sessionId: "session-1",
      },
    ]);
    expect(result).toEqual({});
  });

  it("appends thread realtime text through codex management owner", async () => {
    const appClient = new TestAppServerClient();
    const owner = createOwner(appClient);

    const result = await owner.appendThreadRealtimeText({
      threadId: "thread-1",
      text: "Continue with implementation details.",
    });

    expect(appClient.appendThreadRealtimeTextCalls).toEqual([
      {
        threadId: "thread-1",
        text: "Continue with implementation details.",
      },
    ]);
    expect(result).toEqual({});
  });

  it("appends thread realtime audio through codex management owner", async () => {
    const appClient = new TestAppServerClient();
    const owner = createOwner(appClient);

    const result = await owner.appendThreadRealtimeAudio({
      threadId: "thread-1",
      audio: {
        data: "base64-audio-chunk",
        sampleRate: 16000,
        numChannels: 1,
        samplesPerChannel: 640,
      },
    });

    expect(appClient.appendThreadRealtimeAudioCalls).toEqual([
      {
        threadId: "thread-1",
        audio: {
          data: "base64-audio-chunk",
          sampleRate: 16000,
          numChannels: 1,
          samplesPerChannel: 640,
        },
      },
    ]);
    expect(result).toEqual({});
  });

  it("stops thread realtime through codex management owner", async () => {
    const appClient = new TestAppServerClient();
    const owner = createOwner(appClient);

    const result = await owner.stopThreadRealtime({
      threadId: "thread-1",
    });

    expect(appClient.stopThreadRealtimeCalls).toEqual([
      {
        threadId: "thread-1",
      },
    ]);
    expect(result).toEqual({});
  });

  it("starts windows sandbox setup through codex management owner", async () => {
    const appClient = new TestAppServerClient({
      startWindowsSandboxSetupResult: {
        started: true,
      },
    });
    const owner = createOwner(appClient);

    const result = await owner.startWindowsSandboxSetup({
      mode: "elevated",
    });

    expect(appClient.startWindowsSandboxSetupCalls).toEqual([
      {
        mode: "elevated",
      },
    ]);
    expect(result).toEqual({
      started: true,
    });
  });

  it("prefers active profile config defaults and requests config without layers", async () => {
    const appClient = new TestAppServerClient({
      readConfigResult: {
        config: {
          profile: "work",
          model: "global-model",
          model_reasoning_effort: "minimal",
          profiles: {
            work: {
              model: "profile-model",
              model_reasoning_effort: "high",
            },
          },
        },
      },
    });
    const owner = createOwner(appClient);

    const result = await owner.readConfigDefaults();

    expect(appClient.readConfigCalls).toEqual([
      {
        includeLayers: false,
      },
    ]);
    expect(result).toEqual({
      model: "profile-model",
      reasoningEffort: "high",
    });
  });

  it("uses global config defaults when active profile is missing", async () => {
    const appClient = new TestAppServerClient({
      readConfigResult: {
        config: {
          profile: "missing",
          model: "global-model",
          model_reasoning_effort: "medium",
          profiles: {},
        },
      },
    });
    const owner = createOwner(appClient);

    const result = await owner.readConfigDefaults();

    expect(result).toEqual({
      model: "global-model",
      reasoningEffort: "medium",
    });
  });
});

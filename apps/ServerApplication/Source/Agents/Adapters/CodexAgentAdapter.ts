import {
  AppServerClient,
  CodexMonitorService,
  DesktopIpcClient,
  type SendRequestOptions,
} from "@farfield/api";
import type {
  AppServerCollaborationModeListResponse,
  AppServerListModelsResponse,
  IpcRequestFrame,
  IpcResponseFrame,
} from "@farfield/protocol";
import type {
  AgentAdapter,
  AgentAppendThreadRealtimeAudioInput,
  AgentAppendThreadRealtimeAudioResult,
  AgentAppendThreadRealtimeTextInput,
  AgentAppendThreadRealtimeTextResult,
  AgentCancelAccountLoginInput,
  AgentCancelAccountLoginResult,
  AgentCapabilities,
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
  AgentInterruptInput,
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
  AgentNotificationEvents,
  AgentReadAccountInput,
  AgentReadAccountRateLimitsInput,
  AgentReadAccountRateLimitsResult,
  AgentReadAccountResult,
  AgentReadAuthStatusInput,
  AgentReadAuthStatusResult,
  AgentReadConfigRequirementsInput,
  AgentReadConfigRequirementsResult,
  AgentReadNotificationEventsInput,
  AgentReadStreamEventsInput,
  AgentReadThreadInput,
  AgentReadThreadResult,
  AgentReadUserInfoResult,
  AgentSendMessageInput,
  AgentSetCollaborationModeInput,
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
  AgentSubmitUserInputInput,
  AgentThreadLiveState,
  AgentThreadStreamEvents,
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
  APP_SERVER_INVALID_REQUEST_MESSAGE_FRAGMENT,
  CODEX_AGENT_CAPABILITIES,
  CODEX_AGENT_IDENTIFIER,
  CODEX_AGENT_LABEL,
  type CodexAgentRuntimeState,
  type CodexIpcFrameEvent,
  isInvalidRequestErrorMatchingMessageFragment,
} from "./CodexAgentAdapterContracts.js";
import { wireCodexAgentAdapterIpcIngress } from "./CodexAgentAdapterIpcIngressWiring.js";
import { createCodexAgentAdapterOwners } from "./CodexAgentAdapterOwnerFactory.js";
import { CodexAppServerStderrOwner } from "./CodexAppServerStderrOwner.js";
import { CodexConnectionLifecycleOwner } from "./CodexConnectionLifecycleOwner.js";
import { CodexMessageDispatchOwner } from "./CodexMessageDispatchOwner.js";
import { CodexThreadInteractionOwner } from "./CodexThreadInteractionOwner.js";
import { CodexThreadManagementOwner } from "./CodexThreadManagementOwner.js";
import { CodexThreadStreamStateOwner } from "./CodexThreadStreamStateOwner.js";

export type { CodexAgentRuntimeState, CodexIpcFrameEvent } from "./CodexAgentAdapterContracts.js";

export interface CodexAgentOptions {
  appExecutable: string;
  appServerBaseEnvironment: NodeJS.ProcessEnv;
  socketPath: string;
  invalidStreamEventsLogPath: string;
  workspaceDir: string;
  userAgent: string;
  reconnectDelayMs: number;
  onStateChange?: () => void;
}

/**
 * Owns Codex adapter composition and delegates behavior to connection/thread owners.
 * This class keeps wiring explicit so owner responsibilities stay isolated and testable.
 */
export class CodexAgentAdapter implements AgentAdapter {
  public readonly id = CODEX_AGENT_IDENTIFIER;
  public readonly label = CODEX_AGENT_LABEL;
  public readonly capabilities: AgentCapabilities = CODEX_AGENT_CAPABILITIES;

  private readonly appClient: AppServerClient;
  private readonly ipcClient: DesktopIpcClient;
  private readonly service: CodexMonitorService;
  private readonly appServerStderrOwner: CodexAppServerStderrOwner;
  private readonly threadStreamStateOwner: CodexThreadStreamStateOwner;
  private readonly connectionLifecycleOwner: CodexConnectionLifecycleOwner;
  private readonly messageDispatchOwner: CodexMessageDispatchOwner;
  private readonly threadManagementOwner: CodexThreadManagementOwner;
  private readonly threadInteractionOwner: CodexThreadInteractionOwner;
  private readonly workspaceDir: string;

  private readonly ipcFrameListeners = new Set<(event: CodexIpcFrameEvent) => void>();

  public constructor(options: CodexAgentOptions) {
    this.workspaceDir = options.workspaceDir;
    this.appServerStderrOwner = new CodexAppServerStderrOwner();
    this.threadStreamStateOwner = new CodexThreadStreamStateOwner({
      invalidStreamEventsLogPath: options.invalidStreamEventsLogPath,
    });

    this.appClient = new AppServerClient({
      executablePath: options.appExecutable,
      baseEnvironment: options.appServerBaseEnvironment,
      userAgent: options.userAgent,
      cwd: options.workspaceDir,
      onStderr: (line) => {
        this.appServerStderrOwner.handleStderrLine(line);
      },
    });

    this.ipcClient = new DesktopIpcClient({
      socketPath: options.socketPath,
    });
    this.service = new CodexMonitorService(this.ipcClient);
    this.connectionLifecycleOwner = new CodexConnectionLifecycleOwner({
      appClient: this.appClient,
      ipcClient: this.ipcClient,
      label: this.label,
      reconnectDelayMs: options.reconnectDelayMs,
      onStateChange: options.onStateChange ?? null,
    });
    const owners = createCodexAgentAdapterOwners({
      appClient: this.appClient,
      ipcClient: this.ipcClient,
      service: this.service,
      threadStreamStateOwner: this.threadStreamStateOwner,
      connectionLifecycleOwner: this.connectionLifecycleOwner,
      emitIpcFrame: (event) => {
        this.emitIpcFrame(event);
      },
      ensureCodexAvailable: () => {
        this.ensureCodexAvailable();
      },
      ensureIpcReady: () => {
        this.ensureIpcReady();
      },
      isConversationNotFoundError: <ErrorType>(error: ErrorType): boolean => {
        return this.isConversationNotFoundError(error);
      },
    });
    this.messageDispatchOwner = owners.messageDispatchOwner;
    this.threadManagementOwner = owners.threadManagementOwner;
    this.threadInteractionOwner = owners.threadInteractionOwner;

    wireCodexAgentAdapterIpcIngress({
      ipcClient: this.ipcClient,
      connectionLifecycleOwner: this.connectionLifecycleOwner,
      threadStreamStateOwner: this.threadStreamStateOwner,
      emitIpcFrame: (event) => {
        this.emitIpcFrame(event);
      },
    });
  }

  public onIpcFrame(listener: (event: CodexIpcFrameEvent) => void): () => void {
    this.ipcFrameListeners.add(listener);
    return () => {
      this.ipcFrameListeners.delete(listener);
    };
  }

  public getRuntimeState(): CodexAgentRuntimeState {
    return this.connectionLifecycleOwner.getRuntimeState();
  }

  public getThreadOwnerCount(): number {
    return this.threadStreamStateOwner.getThreadOwnerCount();
  }

  public isThreadNotLoadedError(error: Error): boolean {
    return isInvalidRequestErrorMatchingMessageFragment(
      error,
      APP_SERVER_INVALID_REQUEST_MESSAGE_FRAGMENT.threadNotLoaded,
    );
  }

  public isConversationNotFoundError<ErrorType>(error: ErrorType): boolean {
    return isInvalidRequestErrorMatchingMessageFragment(
      error,
      APP_SERVER_INVALID_REQUEST_MESSAGE_FRAGMENT.conversationNotFound,
    );
  }

  public isEnabled(): boolean {
    return true;
  }

  public isConnected(): boolean {
    return this.connectionLifecycleOwner.isConnected();
  }

  public isIpcReady(): boolean {
    return this.connectionLifecycleOwner.isIpcReady();
  }

  public async start(): Promise<void> {
    this.connectionLifecycleOwner.markStarted();
    await this.connectionLifecycleOwner.bootstrapConnections();
  }

  public async stop(): Promise<void> {
    this.connectionLifecycleOwner.markStopped();
    await this.ipcClient.disconnect();
    await this.appClient.close();
  }

  public async listProjectDirectories(): Promise<string[]> {
    return [this.workspaceDir];
  }

  public async listThreads(input: AgentListThreadsInput): Promise<AgentListThreadsResult> {
    return this.threadManagementOwner.listThreads(input);
  }

  public async createThread(input: AgentCreateThreadInput): Promise<AgentCreateThreadResult> {
    return this.threadManagementOwner.createThread(input);
  }

  public async readThread(input: AgentReadThreadInput): Promise<AgentReadThreadResult> {
    return this.threadManagementOwner.readThread(input);
  }

  public async listLoadedThreads(): Promise<AgentListLoadedThreadsResult> {
    return this.threadManagementOwner.listLoadedThreads();
  }

  public async sendMessage(input: AgentSendMessageInput): Promise<void> {
    this.ensureCodexAvailable();
    await this.messageDispatchOwner.sendMessage(input, this.isIpcReady());
  }

  public async interrupt(input: AgentInterruptInput): Promise<void> {
    await this.threadInteractionOwner.interrupt(input);
  }

  public async forkThread(input: { threadId: string }): Promise<AgentCreateThreadResult> {
    return this.threadManagementOwner.forkThread(input);
  }

  public async setThreadName(input: { threadId: string; name: string }): Promise<void> {
    await this.threadManagementOwner.setThreadName(input);
  }

  public async rollbackThread(input: {
    threadId: string;
    numTurns: number;
  }): Promise<AgentReadThreadResult> {
    return this.threadManagementOwner.rollbackThread(input);
  }

  public async compactThread(input: AgentCompactThreadInput): Promise<void> {
    await this.threadManagementOwner.compactThread(input);
  }

  public async cleanThreadBackgroundTerminals(
    input: AgentCleanThreadBackgroundTerminalsInput,
  ): Promise<void> {
    await this.threadManagementOwner.cleanThreadBackgroundTerminals(input);
  }

  public async unsubscribeThread(
    input: AgentUnsubscribeThreadInput,
  ): Promise<AgentUnsubscribeThreadStatus> {
    return this.threadManagementOwner.unsubscribeThread(input);
  }

  public async startThreadReview(
    input: AgentStartThreadReviewInput,
  ): Promise<AgentStartThreadReviewResult> {
    return this.threadManagementOwner.startThreadReview(input);
  }

  public async archiveThread(input: { threadId: string }): Promise<void> {
    await this.threadManagementOwner.archiveThread(input);
  }

  public async unarchiveThread(input: { threadId: string }): Promise<void> {
    await this.threadManagementOwner.unarchiveThread(input);
  }

  public async listModels(limit: number): Promise<AppServerListModelsResponse> {
    return this.threadManagementOwner.listModels(limit);
  }

  public async listCollaborationModes(): Promise<AppServerCollaborationModeListResponse> {
    return this.threadManagementOwner.listCollaborationModes();
  }

  public async readConfigRequirements(
    input?: AgentReadConfigRequirementsInput,
  ): Promise<AgentReadConfigRequirementsResult> {
    return this.threadManagementOwner.readConfigRequirements(input);
  }

  public async listExperimentalFeatures(
    input?: AgentListExperimentalFeaturesInput,
  ): Promise<AgentListExperimentalFeaturesResult> {
    return this.threadManagementOwner.listExperimentalFeatures(input);
  }

  public async listMcpServerStatuses(
    input?: AgentListMcpServerStatusesInput,
  ): Promise<AgentListMcpServerStatusesResult> {
    return this.threadManagementOwner.listMcpServerStatuses(input);
  }

  public async listApps(input?: AgentListAppsInput): Promise<AgentListAppsResult> {
    return this.threadManagementOwner.listApps(input);
  }

  public async listSkills(input?: AgentListSkillsInput): Promise<AgentListSkillsResult> {
    return this.threadManagementOwner.listSkills(input);
  }

  public async readAccount(input?: AgentReadAccountInput): Promise<AgentReadAccountResult> {
    return this.threadManagementOwner.readAccount(input);
  }

  public async readAuthStatus(
    input?: AgentReadAuthStatusInput,
  ): Promise<AgentReadAuthStatusResult> {
    return this.threadManagementOwner.readAuthStatus(input);
  }

  public async readAccountRateLimits(
    input?: AgentReadAccountRateLimitsInput,
  ): Promise<AgentReadAccountRateLimitsResult> {
    return this.threadManagementOwner.readAccountRateLimits(input);
  }

  public async readUserInfo(): Promise<AgentReadUserInfoResult> {
    return this.threadManagementOwner.readUserInfo();
  }

  public async uploadFeedback(input: AgentUploadFeedbackInput): Promise<AgentUploadFeedbackResult> {
    return this.threadManagementOwner.uploadFeedback(input);
  }

  public async gitDiffToRemote(
    input: AgentGitDiffToRemoteInput,
  ): Promise<AgentGitDiffToRemoteResult> {
    return this.threadManagementOwner.gitDiffToRemote(input);
  }

  public async fuzzyFileSearch(
    input: AgentFuzzyFileSearchInput,
  ): Promise<AgentFuzzyFileSearchResult> {
    return this.threadManagementOwner.fuzzyFileSearch(input);
  }

  public async startFuzzyFileSearchSession(
    input: AgentFuzzyFileSearchSessionStartInput,
  ): Promise<AgentFuzzyFileSearchSessionStartResult> {
    return this.threadManagementOwner.startFuzzyFileSearchSession(input);
  }

  public async updateFuzzyFileSearchSession(
    input: AgentFuzzyFileSearchSessionUpdateInput,
  ): Promise<AgentFuzzyFileSearchSessionUpdateResult> {
    return this.threadManagementOwner.updateFuzzyFileSearchSession(input);
  }

  public async stopFuzzyFileSearchSession(
    input: AgentFuzzyFileSearchSessionStopInput,
  ): Promise<AgentFuzzyFileSearchSessionStopResult> {
    return this.threadManagementOwner.stopFuzzyFileSearchSession(input);
  }

  public async executeCommand(
    input: AgentCommandExecutionInput,
  ): Promise<AgentCommandExecutionResult> {
    return this.threadManagementOwner.executeCommand(input);
  }

  public async startAccountLogin(
    input: AgentStartAccountLoginInput,
  ): Promise<AgentStartAccountLoginResult> {
    return this.threadManagementOwner.startAccountLogin(input);
  }

  public async cancelAccountLogin(
    input: AgentCancelAccountLoginInput,
  ): Promise<AgentCancelAccountLoginResult> {
    return this.threadManagementOwner.cancelAccountLogin(input);
  }

  public async logoutAccount(): Promise<void> {
    await this.threadManagementOwner.logoutAccount();
  }

  public async reloadMcpServerConfig(): Promise<void> {
    await this.threadManagementOwner.reloadMcpServerConfig();
  }

  public async startMcpServerOauthLogin(
    input: AgentStartMcpServerOauthLoginInput,
  ): Promise<AgentStartMcpServerOauthLoginResult> {
    return this.threadManagementOwner.startMcpServerOauthLogin(input);
  }

  public async writeConfigValue(
    input: AgentWriteConfigValueInput,
  ): Promise<AgentWriteConfigValueResult> {
    return this.threadManagementOwner.writeConfigValue(input);
  }

  public async writeConfigBatch(
    input: AgentWriteConfigBatchInput,
  ): Promise<AgentWriteConfigValueResult> {
    return this.threadManagementOwner.writeConfigBatch(input);
  }

  public async writeSkillsConfig(
    input: AgentWriteSkillsConfigInput,
  ): Promise<AgentWriteSkillsConfigResult> {
    return this.threadManagementOwner.writeSkillsConfig(input);
  }

  public async listRemoteSkills(
    input: AgentListRemoteSkillsInput,
  ): Promise<AgentListRemoteSkillsResult> {
    return this.threadManagementOwner.listRemoteSkills(input);
  }

  public async exportRemoteSkill(
    input: AgentExportRemoteSkillInput,
  ): Promise<AgentExportRemoteSkillResult> {
    return this.threadManagementOwner.exportRemoteSkill(input);
  }

  public async detectExternalAgentConfig(
    input: AgentDetectExternalAgentConfigInput,
  ): Promise<AgentDetectExternalAgentConfigResult> {
    return this.threadManagementOwner.detectExternalAgentConfig(input);
  }

  public async importExternalAgentConfig(
    input: AgentImportExternalAgentConfigInput,
  ): Promise<AgentImportExternalAgentConfigResult> {
    return this.threadManagementOwner.importExternalAgentConfig(input);
  }

  public async startThreadRealtime(
    input: AgentStartThreadRealtimeInput,
  ): Promise<AgentStartThreadRealtimeResult> {
    return this.threadManagementOwner.startThreadRealtime(input);
  }

  public async appendThreadRealtimeText(
    input: AgentAppendThreadRealtimeTextInput,
  ): Promise<AgentAppendThreadRealtimeTextResult> {
    return this.threadManagementOwner.appendThreadRealtimeText(input);
  }

  public async appendThreadRealtimeAudio(
    input: AgentAppendThreadRealtimeAudioInput,
  ): Promise<AgentAppendThreadRealtimeAudioResult> {
    return this.threadManagementOwner.appendThreadRealtimeAudio(input);
  }

  public async stopThreadRealtime(
    input: AgentStopThreadRealtimeInput,
  ): Promise<AgentStopThreadRealtimeResult> {
    return this.threadManagementOwner.stopThreadRealtime(input);
  }

  public async startWindowsSandboxSetup(
    input: AgentStartWindowsSandboxSetupInput,
  ): Promise<AgentStartWindowsSandboxSetupResult> {
    return this.threadManagementOwner.startWindowsSandboxSetup(input);
  }

  public async readConfigDefaults(): Promise<AgentConfigDefaults> {
    return this.threadManagementOwner.readConfigDefaults();
  }

  public async setCollaborationMode(
    input: AgentSetCollaborationModeInput,
  ): Promise<{ ownerClientId: string }> {
    return this.threadInteractionOwner.setCollaborationMode(input);
  }

  public async submitUserInput(
    input: AgentSubmitUserInputInput,
  ): Promise<{ ownerClientId: string; requestId: number }> {
    return this.threadInteractionOwner.submitUserInput(input);
  }

  public async readLiveState(threadId: string): Promise<AgentThreadLiveState> {
    return this.threadInteractionOwner.readLiveState(threadId);
  }

  public async readStreamEvents(
    threadId: string,
    input: AgentReadStreamEventsInput,
  ): Promise<AgentThreadStreamEvents> {
    return this.threadInteractionOwner.readStreamEvents(threadId, input);
  }

  public async readNotificationEvents(
    input: AgentReadNotificationEventsInput,
  ): Promise<AgentNotificationEvents> {
    return this.threadInteractionOwner.readNotificationEvents(input);
  }

  public async replayRequest(
    method: string,
    params: IpcRequestFrame["params"],
    options: SendRequestOptions = {},
  ): Promise<IpcResponseFrame["result"]> {
    return this.threadInteractionOwner.replayRequest(method, params, options);
  }

  public replayBroadcast(
    method: string,
    params: IpcRequestFrame["params"],
    options: SendRequestOptions = {},
  ): void {
    this.threadInteractionOwner.replayBroadcast(method, params, options);
  }

  private emitIpcFrame(event: CodexIpcFrameEvent): void {
    for (const listener of this.ipcFrameListeners) {
      listener(event);
    }
  }

  private ensureCodexAvailable(): void {
    this.connectionLifecycleOwner.ensureCodexAvailable();
  }

  private ensureIpcReady(): void {
    this.connectionLifecycleOwner.ensureIpcReady();
  }
}

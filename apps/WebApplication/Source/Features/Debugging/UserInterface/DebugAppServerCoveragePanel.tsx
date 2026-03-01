import { RefreshCcw } from "lucide-react";
import { Button } from "@/Components/UserInterface/Button";
import {
  type DebugAppServerCoverageAuthCompletionEventsResult,
  type DebugAppServerCoverageCommandExecutionResult,
  type DebugAppServerCoverageConfigBatchWriteResult,
  type DebugAppServerCoverageConfigValueWriteResult,
  type DebugAppServerCoverageExternalAgentConfigDetectResult,
  type DebugAppServerCoverageExternalAgentConfigImportResult,
  type DebugAppServerCoverageExternalAgentConfigMigrationItem,
  type DebugAppServerCoverageFeedbackUploadResult,
  type DebugAppServerCoverageFuzzyFileSearchResult,
  type DebugAppServerCoverageFuzzyFileSearchSessionStartResult,
  type DebugAppServerCoverageFuzzyFileSearchSessionStopResult,
  type DebugAppServerCoverageFuzzyFileSearchSessionUpdateResult,
  type DebugAppServerCoverageFuzzySessionNotificationsResult,
  type DebugAppServerCoverageGitDiffToRemoteResult,
  type DebugAppServerCoverageNotificationEventsResult,
  type DebugAppServerCoveragePendingAccountLogin,
  type DebugAppServerCoveragePendingServerRequestsResult,
  type DebugAppServerCoverageServerRequestResolvedEventsResult,
  type DebugAppServerCoverageSnapshot,
  type DebugAppServerCoverageThreadRealtimeAppendAudioResult,
  type DebugAppServerCoverageThreadRealtimeAppendTextResult,
  type DebugAppServerCoverageThreadRealtimeAudioChunk,
  type DebugAppServerCoverageThreadRealtimeStartResult,
  type DebugAppServerCoverageThreadRealtimeStopResult,
  type DebugAppServerCoverageThreadStreamEventsResult,
  type DebugAppServerCoverageWindowsSandboxSetupMode,
  type DebugAppServerCoverageWindowsSandboxSetupStartResult,
} from "../DomainModel/DebugAppServerCoverageContracts";
import { DebugAppServerCoverageAuthCompletionEventsSection } from "./DebugAppServerCoverageAuthCompletionEventsSection";
import { DebugAppServerCoverageCommandExecutionSection } from "./DebugAppServerCoverageCommandExecutionSection";
import { DebugAppServerCoverageConfigBatchWriteSection } from "./DebugAppServerCoverageConfigBatchWriteSection";
import { DebugAppServerCoverageConfigValueWriteSection } from "./DebugAppServerCoverageConfigValueWriteSection";
import { DebugAppServerCoverageExternalAgentConfigSection } from "./DebugAppServerCoverageExternalAgentConfigSection";
import { DebugAppServerCoverageFeedbackUploadSection } from "./DebugAppServerCoverageFeedbackUploadSection";
import { DebugAppServerCoverageFuzzyFileSearchSection } from "./DebugAppServerCoverageFuzzyFileSearchSection";
import { DebugAppServerCoverageFuzzySessionNotificationsSection } from "./DebugAppServerCoverageFuzzySessionNotificationsSection";
import { DebugAppServerCoverageGitDiffToRemoteSection } from "./DebugAppServerCoverageGitDiffToRemoteSection";
import { DebugAppServerCoverageNotificationEventsSection } from "./DebugAppServerCoverageNotificationEventsSection";
import { DebugAppServerCoveragePendingServerRequestsSection } from "./DebugAppServerCoveragePendingServerRequestsSection";
import { DebugAppServerCoverageRealtimeAndWindowsSection } from "./DebugAppServerCoverageRealtimeAndWindowsSection";
import { DebugAppServerCoverageServerRequestResolvedEventsSection } from "./DebugAppServerCoverageServerRequestResolvedEventsSection";
import { DebugAppServerCoverageThreadStreamEventsSection } from "./DebugAppServerCoverageThreadStreamEventsSection";

export interface DebugAppServerCoveragePanelProps {
  isLoadingCoverageDiagnostics: boolean;
  isRunningCoverageAction: boolean;
  coverageDiagnosticsErrorMessage: string;
  coverageActionErrorMessage: string;
  coverageDiagnosticsSnapshot: DebugAppServerCoverageSnapshot | null;
  pendingAccountLogin: DebugAppServerCoveragePendingAccountLogin | null;
  lastAuthCompletionEventsResult: DebugAppServerCoverageAuthCompletionEventsResult | null;
  lastCommandExecutionResult: DebugAppServerCoverageCommandExecutionResult | null;
  lastConfigBatchWriteResult: DebugAppServerCoverageConfigBatchWriteResult | null;
  lastConfigValueWriteResult: DebugAppServerCoverageConfigValueWriteResult | null;
  lastExternalAgentConfigDetectResult: DebugAppServerCoverageExternalAgentConfigDetectResult | null;
  lastExternalAgentConfigImportResult: DebugAppServerCoverageExternalAgentConfigImportResult | null;
  lastThreadRealtimeStartResult: DebugAppServerCoverageThreadRealtimeStartResult | null;
  lastThreadRealtimeAppendAudioResult: DebugAppServerCoverageThreadRealtimeAppendAudioResult | null;
  lastThreadRealtimeAppendTextResult: DebugAppServerCoverageThreadRealtimeAppendTextResult | null;
  lastThreadRealtimeStopResult: DebugAppServerCoverageThreadRealtimeStopResult | null;
  lastThreadStreamEventsResult: DebugAppServerCoverageThreadStreamEventsResult | null;
  lastNotificationEventsResult: DebugAppServerCoverageNotificationEventsResult | null;
  lastPendingServerRequestsResult: DebugAppServerCoveragePendingServerRequestsResult | null;
  lastServerRequestResolvedEventsResult: DebugAppServerCoverageServerRequestResolvedEventsResult | null;
  lastWindowsSandboxSetupStartResult: DebugAppServerCoverageWindowsSandboxSetupStartResult | null;
  lastFeedbackUploadResult: DebugAppServerCoverageFeedbackUploadResult | null;
  lastFuzzyFileSearchResult: DebugAppServerCoverageFuzzyFileSearchResult | null;
  lastFuzzyFileSearchSessionStartResult: DebugAppServerCoverageFuzzyFileSearchSessionStartResult | null;
  lastFuzzyFileSearchSessionUpdateResult: DebugAppServerCoverageFuzzyFileSearchSessionUpdateResult | null;
  lastFuzzyFileSearchSessionStopResult: DebugAppServerCoverageFuzzyFileSearchSessionStopResult | null;
  lastFuzzySessionNotificationsResult: DebugAppServerCoverageFuzzySessionNotificationsResult | null;
  lastGitDiffToRemoteResult: DebugAppServerCoverageGitDiffToRemoteResult | null;
  onRefreshCoverageDiagnostics: () => void;
  onStartAccountLogin: () => void;
  onCancelAccountLogin: () => void;
  onLogoutAccount: () => void;
  onReloadMcpServerConfig: () => void;
  onStartMcpServerOauthLogin: (serverName: string) => void;
  onWriteConfigValue: (
    keyPath: string,
    value: string,
    mergeStrategy: "replace" | "upsert",
    filePath?: string,
    expectedVersion?: string,
  ) => void;
  onWriteConfigBatch: (edits: string, filePath?: string, expectedVersion?: string) => void;
  onWriteSkillsConfig: (skillPath: string, enabled: boolean) => void;
  onExportRemoteSkill: (hazelnutId: string) => void;
  onDetectExternalAgentConfig: (includeHome: boolean, cwds: string[]) => void;
  onImportExternalAgentConfig: (
    migrationItems: DebugAppServerCoverageExternalAgentConfigMigrationItem[],
  ) => void;
  onStartThreadRealtime: (threadId: string, prompt: string, sessionId?: string) => void;
  onAppendThreadRealtimeAudio: (
    threadId: string,
    audio: DebugAppServerCoverageThreadRealtimeAudioChunk,
  ) => void;
  onAppendThreadRealtimeText: (threadId: string, text: string) => void;
  onStopThreadRealtime: (threadId: string) => void;
  onReadThreadStreamEvents: (threadId: string, sinceSequence?: number | null) => void;
  onReadNotificationEvents: (sinceSequence?: number | null) => void;
  onReadAuthCompletionEvents: (sinceSequence?: number | null) => void;
  onReadServerRequestResolvedEvents: (sinceSequence?: number | null) => void;
  onReadPendingServerRequests: () => void;
  onStartWindowsSandboxSetup: (mode: DebugAppServerCoverageWindowsSandboxSetupMode) => void;
  onReadGitDiffToRemote: (cwd: string) => void;
  onSearchFuzzyFiles: (query: string, roots: string[], cancellationToken?: string) => void;
  onStartFuzzyFileSearchSession: (sessionId: string, roots: string[]) => void;
  onUpdateFuzzyFileSearchSession: (sessionId: string, query: string) => void;
  onStopFuzzyFileSearchSession: (sessionId: string) => void;
  onReadFuzzySessionNotifications: (sinceSequence?: number | null) => void;
  onExecuteCommand: (command: string[], timeoutMs?: number, cwd?: string) => void;
  onUploadFeedback: (
    classification: string,
    includeLogs: boolean,
    reason?: string,
    threadId?: string,
  ) => void;
}

function renderListValues(values: string[] | null): string {
  if (values === null || values.length === 0) {
    return "None";
  }
  return values.join(", ");
}

/**
 * Owns display of app-server coverage diagnostics used for integration debugging.
 * Rendering is intentionally compact so this panel remains scan-friendly during active troubleshooting.
 */
export function DebugAppServerCoveragePanel({
  isLoadingCoverageDiagnostics,
  isRunningCoverageAction,
  coverageDiagnosticsErrorMessage,
  coverageActionErrorMessage,
  coverageDiagnosticsSnapshot,
  pendingAccountLogin,
  lastAuthCompletionEventsResult,
  lastCommandExecutionResult,
  lastConfigBatchWriteResult,
  lastConfigValueWriteResult,
  lastExternalAgentConfigDetectResult,
  lastExternalAgentConfigImportResult,
  lastThreadRealtimeStartResult,
  lastThreadRealtimeAppendAudioResult,
  lastThreadRealtimeAppendTextResult,
  lastThreadRealtimeStopResult,
  lastThreadStreamEventsResult,
  lastNotificationEventsResult,
  lastPendingServerRequestsResult,
  lastServerRequestResolvedEventsResult,
  lastWindowsSandboxSetupStartResult,
  lastFeedbackUploadResult,
  lastFuzzyFileSearchResult,
  lastFuzzyFileSearchSessionStartResult,
  lastFuzzyFileSearchSessionUpdateResult,
  lastFuzzyFileSearchSessionStopResult,
  lastFuzzySessionNotificationsResult,
  lastGitDiffToRemoteResult,
  onRefreshCoverageDiagnostics,
  onStartAccountLogin,
  onCancelAccountLogin,
  onLogoutAccount,
  onReloadMcpServerConfig,
  onStartMcpServerOauthLogin,
  onWriteConfigValue,
  onWriteConfigBatch,
  onWriteSkillsConfig,
  onExportRemoteSkill,
  onDetectExternalAgentConfig,
  onImportExternalAgentConfig,
  onStartThreadRealtime,
  onAppendThreadRealtimeAudio,
  onAppendThreadRealtimeText,
  onStopThreadRealtime,
  onReadThreadStreamEvents,
  onReadNotificationEvents,
  onReadAuthCompletionEvents,
  onReadServerRequestResolvedEvents,
  onReadPendingServerRequests,
  onStartWindowsSandboxSetup,
  onReadGitDiffToRemote,
  onSearchFuzzyFiles,
  onStartFuzzyFileSearchSession,
  onUpdateFuzzyFileSearchSession,
  onStopFuzzyFileSearchSession,
  onReadFuzzySessionNotifications,
  onExecuteCommand,
  onUploadFeedback,
}: DebugAppServerCoveragePanelProps): React.JSX.Element {
  return (
    <div data-testid="debug-coverage-panel" className="flex-1 min-h-0 overflow-auto p-4 space-y-3">
      <div className="rounded-md border border-border bg-card p-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">App-Server Coverage Diagnostics</h3>
          <p className="text-xs text-muted-foreground">
            Skills, apps, experimental features, MCP status, config requirements, and account
            diagnostics plus config writes, remote skills import, external-agent config migration,
            realtime thread actions, notification and auth-completion reads, pending-request reads,
            windows sandbox setup actions, git diff reads, command execution, fuzzy file search, and
            feedback upload coverage.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="debug-coverage-refresh"
          onClick={onRefreshCoverageDiagnostics}
          disabled={isLoadingCoverageDiagnostics}
        >
          <RefreshCcw size={12} className={isLoadingCoverageDiagnostics ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {isLoadingCoverageDiagnostics && (
        <div
          data-testid="debug-coverage-loading"
          className="rounded-md border border-border bg-card p-3 text-xs text-muted-foreground"
        >
          Loading app-server coverage diagnostics...
        </div>
      )}

      {!isLoadingCoverageDiagnostics && coverageDiagnosticsErrorMessage.length > 0 && (
        <div
          data-testid="debug-coverage-error"
          className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200"
        >
          {coverageDiagnosticsErrorMessage}
        </div>
      )}

      {coverageActionErrorMessage.length > 0 && (
        <div
          data-testid="debug-coverage-action-error"
          className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200"
        >
          {coverageActionErrorMessage}
        </div>
      )}

      {coverageDiagnosticsSnapshot !== null && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-7">
            <div className="rounded-md border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">Skills</p>
              <p className="text-lg font-semibold">{coverageDiagnosticsSnapshot.skills.length}</p>
            </div>
            <div className="rounded-md border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">Remote Skills</p>
              <p className="text-lg font-semibold">
                {coverageDiagnosticsSnapshot.remoteSkills.length}
              </p>
            </div>
            <div className="rounded-md border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">Apps</p>
              <p className="text-lg font-semibold">{coverageDiagnosticsSnapshot.apps.length}</p>
            </div>
            <div className="rounded-md border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">Experimental</p>
              <p className="text-lg font-semibold">
                {coverageDiagnosticsSnapshot.experimentalFeatures.length}
              </p>
            </div>
            <div className="rounded-md border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">MCP Servers</p>
              <p className="text-lg font-semibold">
                {coverageDiagnosticsSnapshot.mcpServers.length}
              </p>
            </div>
            <div className="rounded-md border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">Account</p>
              <p className="text-sm font-medium">
                {coverageDiagnosticsSnapshot.account === null
                  ? "Unavailable"
                  : coverageDiagnosticsSnapshot.account.type === "apiKey"
                    ? "API key"
                    : coverageDiagnosticsSnapshot.account.planType}
              </p>
            </div>
            <div className="rounded-md border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">Refreshed</p>
              <p className="text-sm font-medium">
                {new Date(coverageDiagnosticsSnapshot.refreshedAtIso8601).toLocaleTimeString()}
              </p>
            </div>
          </div>

          <div className="rounded-md border border-border bg-card p-3 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Account
            </h4>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="debug-coverage-account-login-start"
                disabled={
                  isRunningCoverageAction || !coverageDiagnosticsSnapshot.requiresOpenaiAuth
                }
                onClick={onStartAccountLogin}
              >
                Start Login
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="debug-coverage-account-login-cancel"
                disabled={isRunningCoverageAction || pendingAccountLogin === null}
                onClick={onCancelAccountLogin}
              >
                Cancel Login
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="debug-coverage-account-logout"
                disabled={isRunningCoverageAction || coverageDiagnosticsSnapshot.account === null}
                onClick={onLogoutAccount}
              >
                Logout
              </Button>
            </div>
            {coverageDiagnosticsSnapshot.account === null ? (
              <p className="text-xs text-muted-foreground">No account details reported.</p>
            ) : coverageDiagnosticsSnapshot.account.type === "apiKey" ? (
              <p className="text-xs">Authentication mode: API key</p>
            ) : (
              <>
                <p className="text-xs">Email: {coverageDiagnosticsSnapshot.account.email}</p>
                <p className="text-xs">Plan: {coverageDiagnosticsSnapshot.account.planType}</p>
              </>
            )}
            <p className="text-xs">
              Requires OpenAI auth: {coverageDiagnosticsSnapshot.requiresOpenaiAuth ? "Yes" : "No"}
            </p>
            {coverageDiagnosticsSnapshot.authStatus === null ? (
              <p className="text-xs text-muted-foreground">No auth-status diagnostics reported.</p>
            ) : (
              <>
                <p className="text-xs">
                  Auth method: {coverageDiagnosticsSnapshot.authStatus.authMethod ?? "None"}
                </p>
                <p className="text-xs">
                  Auth token returned:{" "}
                  {coverageDiagnosticsSnapshot.authStatus.authToken === null ? "No" : "Yes"}
                </p>
                <p className="text-xs">
                  Auth status requires OpenAI auth:{" "}
                  {coverageDiagnosticsSnapshot.authStatus.requiresOpenaiAuth === null
                    ? "Unknown"
                    : coverageDiagnosticsSnapshot.authStatus.requiresOpenaiAuth
                      ? "Yes"
                      : "No"}
                </p>
              </>
            )}
            {coverageDiagnosticsSnapshot.userInfo === null ? (
              <p className="text-xs text-muted-foreground">No user-info diagnostics reported.</p>
            ) : (
              <p className="text-xs">
                User email: {coverageDiagnosticsSnapshot.userInfo.allegedUserEmail ?? "None"}
              </p>
            )}
            {pendingAccountLogin !== null && (
              <>
                <p className="text-xs">Pending login id: {pendingAccountLogin.loginId}</p>
                <p className="text-xs">
                  Auth URL:{" "}
                  <a
                    href={pendingAccountLogin.authUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 underline underline-offset-2"
                  >
                    Open login page
                  </a>
                </p>
              </>
            )}
            {coverageDiagnosticsSnapshot.accountRateLimits === null ? (
              <p className="text-xs text-muted-foreground">No rate limits reported.</p>
            ) : (
              <>
                <p className="text-xs">
                  Rate limit id: {coverageDiagnosticsSnapshot.accountRateLimits.limitId ?? "None"}
                </p>
                <p className="text-xs">
                  Primary window used:{" "}
                  {coverageDiagnosticsSnapshot.accountRateLimits.primary === null
                    ? "None"
                    : `${String(coverageDiagnosticsSnapshot.accountRateLimits.primary.usedPercent)}%`}
                </p>
              </>
            )}
          </div>

          <div className="rounded-md border border-border bg-card p-3 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Config Requirements
            </h4>
            <p className="text-xs">
              Approval policies:{" "}
              {renderListValues(
                coverageDiagnosticsSnapshot.requirements?.allowedApprovalPolicies ?? null,
              )}
            </p>
            <p className="text-xs">
              Sandbox modes:{" "}
              {renderListValues(
                coverageDiagnosticsSnapshot.requirements?.allowedSandboxModes ?? null,
              )}
            </p>
            <p className="text-xs">
              Web search modes:{" "}
              {renderListValues(
                coverageDiagnosticsSnapshot.requirements?.allowedWebSearchModes ?? null,
              )}
            </p>
            <p className="text-xs">
              Residency: {coverageDiagnosticsSnapshot.requirements?.enforceResidency ?? "None"}
            </p>
          </div>

          <div className="rounded-md border border-border bg-card p-3 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Experimental Features
            </h4>
            {coverageDiagnosticsSnapshot.experimentalFeatures.length === 0 ? (
              <p className="text-xs text-muted-foreground">No experimental features reported.</p>
            ) : (
              coverageDiagnosticsSnapshot.experimentalFeatures.map((feature) => (
                <div
                  key={feature.name}
                  className="flex items-center justify-between gap-2 text-xs"
                  data-testid={`debug-coverage-feature-${feature.name}`}
                >
                  <span className="font-medium">{feature.displayName ?? feature.name}</span>
                  <span className="text-muted-foreground">{feature.stage}</span>
                </div>
              ))
            )}
          </div>

          <div className="rounded-md border border-border bg-card p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                MCP Servers
              </h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="debug-coverage-mcp-reload"
                disabled={isRunningCoverageAction}
                onClick={onReloadMcpServerConfig}
              >
                Reload Config
              </Button>
            </div>
            {coverageDiagnosticsSnapshot.mcpServers.length === 0 ? (
              <p className="text-xs text-muted-foreground">No MCP servers reported.</p>
            ) : (
              coverageDiagnosticsSnapshot.mcpServers.map((server) => (
                <div
                  key={server.name}
                  className="space-y-1 text-xs"
                  data-testid={`debug-coverage-mcp-${server.name}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span>{server.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {server.toolCount} tools • {server.authStatus}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        data-testid={`debug-coverage-mcp-oauth-${server.name}`}
                        disabled={isRunningCoverageAction}
                        onClick={() => {
                          onStartMcpServerOauthLogin(server.name);
                        }}
                      >
                        Start OAuth
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <DebugAppServerCoverageConfigValueWriteSection
            isRunningCoverageAction={isRunningCoverageAction}
            lastConfigValueWriteResult={lastConfigValueWriteResult}
            onWriteConfigValue={onWriteConfigValue}
          />

          <DebugAppServerCoverageConfigBatchWriteSection
            isRunningCoverageAction={isRunningCoverageAction}
            lastConfigBatchWriteResult={lastConfigBatchWriteResult}
            onWriteConfigBatch={onWriteConfigBatch}
          />

          <div className="rounded-md border border-border bg-card p-3 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Skills
            </h4>
            {coverageDiagnosticsSnapshot.skills.length === 0 ? (
              <p className="text-xs text-muted-foreground">No skills reported.</p>
            ) : (
              coverageDiagnosticsSnapshot.skills.map((entry) => (
                <div
                  key={entry.cwd}
                  className="space-y-2 text-xs"
                  data-testid={`debug-coverage-skills-${entry.cwd}`}
                >
                  <p className="font-medium">{entry.cwd}</p>
                  <p className="text-muted-foreground">
                    {entry.skills.length} skills • {entry.errorCount} errors
                  </p>
                  {entry.skills.map((skill) => (
                    <div key={skill.path} className="rounded border border-border/70 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span>
                          {skill.name} ({skill.scope})
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          data-testid={`debug-coverage-skill-toggle-${skill.name}`}
                          disabled={isRunningCoverageAction}
                          onClick={() => {
                            onWriteSkillsConfig(skill.path, !skill.enabled);
                          }}
                        >
                          {skill.enabled ? "Disable" : "Enable"}
                        </Button>
                      </div>
                      <p className="text-muted-foreground break-all">{skill.path}</p>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          <div className="rounded-md border border-border bg-card p-3 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Remote Skills
            </h4>
            <p className="text-xs text-muted-foreground">
              Surface: personal scope, codex product, enabled only.
            </p>
            {coverageDiagnosticsSnapshot.remoteSkills.length === 0 ? (
              <p className="text-xs text-muted-foreground">No remote skills reported.</p>
            ) : (
              coverageDiagnosticsSnapshot.remoteSkills.map((skill) => (
                <div
                  key={skill.id}
                  className="rounded border border-border/70 p-2 space-y-1"
                  data-testid={`debug-coverage-remote-skill-${skill.id}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{skill.name}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      data-testid={`debug-coverage-remote-skill-export-${skill.id}`}
                      disabled={isRunningCoverageAction}
                      onClick={() => {
                        onExportRemoteSkill(skill.id);
                      }}
                    >
                      Export
                    </Button>
                  </div>
                  <p className="text-muted-foreground">{skill.description}</p>
                  <p className="text-muted-foreground break-all">{skill.id}</p>
                </div>
              ))
            )}
          </div>

          <DebugAppServerCoverageExternalAgentConfigSection
            isRunningCoverageAction={isRunningCoverageAction}
            lastExternalAgentConfigDetectResult={lastExternalAgentConfigDetectResult}
            lastExternalAgentConfigImportResult={lastExternalAgentConfigImportResult}
            onDetectExternalAgentConfig={onDetectExternalAgentConfig}
            onImportExternalAgentConfig={onImportExternalAgentConfig}
          />

          <DebugAppServerCoverageRealtimeAndWindowsSection
            isRunningCoverageAction={isRunningCoverageAction}
            lastThreadRealtimeStartResult={lastThreadRealtimeStartResult}
            lastThreadRealtimeAppendAudioResult={lastThreadRealtimeAppendAudioResult}
            lastThreadRealtimeAppendTextResult={lastThreadRealtimeAppendTextResult}
            lastThreadRealtimeStopResult={lastThreadRealtimeStopResult}
            lastWindowsSandboxSetupStartResult={lastWindowsSandboxSetupStartResult}
            onStartThreadRealtime={onStartThreadRealtime}
            onAppendThreadRealtimeAudio={onAppendThreadRealtimeAudio}
            onAppendThreadRealtimeText={onAppendThreadRealtimeText}
            onStopThreadRealtime={onStopThreadRealtime}
            onStartWindowsSandboxSetup={onStartWindowsSandboxSetup}
          />

          <DebugAppServerCoverageThreadStreamEventsSection
            isRunningCoverageAction={isRunningCoverageAction}
            lastThreadStreamEventsResult={lastThreadStreamEventsResult}
            onReadThreadStreamEvents={onReadThreadStreamEvents}
          />

          <DebugAppServerCoverageNotificationEventsSection
            isRunningCoverageAction={isRunningCoverageAction}
            lastNotificationEventsResult={lastNotificationEventsResult}
            onReadNotificationEvents={onReadNotificationEvents}
          />

          <DebugAppServerCoverageAuthCompletionEventsSection
            isRunningCoverageAction={isRunningCoverageAction}
            lastAuthCompletionEventsResult={lastAuthCompletionEventsResult}
            onReadAuthCompletionEvents={onReadAuthCompletionEvents}
          />

          <DebugAppServerCoverageServerRequestResolvedEventsSection
            isRunningCoverageAction={isRunningCoverageAction}
            lastServerRequestResolvedEventsResult={lastServerRequestResolvedEventsResult}
            onReadServerRequestResolvedEvents={onReadServerRequestResolvedEvents}
            onReadPendingServerRequests={onReadPendingServerRequests}
          />

          <DebugAppServerCoveragePendingServerRequestsSection
            isRunningCoverageAction={isRunningCoverageAction}
            lastPendingServerRequestsResult={lastPendingServerRequestsResult}
            onReadPendingServerRequests={onReadPendingServerRequests}
          />

          <DebugAppServerCoverageCommandExecutionSection
            isRunningCoverageAction={isRunningCoverageAction}
            lastCommandExecutionResult={lastCommandExecutionResult}
            onExecuteCommand={onExecuteCommand}
          />

          <DebugAppServerCoverageGitDiffToRemoteSection
            isRunningCoverageAction={isRunningCoverageAction}
            lastGitDiffToRemoteResult={lastGitDiffToRemoteResult}
            onReadGitDiffToRemote={onReadGitDiffToRemote}
          />

          <DebugAppServerCoverageFuzzyFileSearchSection
            isRunningCoverageAction={isRunningCoverageAction}
            lastFuzzyFileSearchResult={lastFuzzyFileSearchResult}
            lastFuzzyFileSearchSessionStartResult={lastFuzzyFileSearchSessionStartResult}
            lastFuzzyFileSearchSessionUpdateResult={lastFuzzyFileSearchSessionUpdateResult}
            lastFuzzyFileSearchSessionStopResult={lastFuzzyFileSearchSessionStopResult}
            onSearchFuzzyFiles={onSearchFuzzyFiles}
            onStartFuzzyFileSearchSession={onStartFuzzyFileSearchSession}
            onUpdateFuzzyFileSearchSession={onUpdateFuzzyFileSearchSession}
            onStopFuzzyFileSearchSession={onStopFuzzyFileSearchSession}
          />

          <DebugAppServerCoverageFuzzySessionNotificationsSection
            isRunningCoverageAction={isRunningCoverageAction}
            lastFuzzySessionNotificationsResult={lastFuzzySessionNotificationsResult}
            onReadFuzzySessionNotifications={onReadFuzzySessionNotifications}
          />

          <DebugAppServerCoverageFeedbackUploadSection
            isRunningCoverageAction={isRunningCoverageAction}
            lastFeedbackUploadResult={lastFeedbackUploadResult}
            onUploadFeedback={onUploadFeedback}
          />
        </>
      )}
    </div>
  );
}

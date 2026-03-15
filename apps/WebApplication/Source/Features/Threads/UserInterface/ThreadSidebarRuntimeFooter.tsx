import { Github } from "lucide-react";
import { memo } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/Components/UserInterface/Tooltip";
import { type ThreadSidebarRuntimeSummary } from "@/Features/Threads/DomainModel/ThreadRuntimeStatusContracts";
import {
  type ThreadSidebarAgentDescriptor,
  type ThreadSidebarPanelHealthState,
} from "./ThreadSidebarPanel";

const SIDEBAR_HEALTH_STATE_READY = "ready";
const SIDEBAR_HEALTH_STATE_FAILURE = "failure";
const SIDEBAR_HEALTH_STATE_PARTIAL = "partial";
const SIDEBAR_HEALTH_CLASS_READY = "bg-success";
const SIDEBAR_HEALTH_CLASS_FAILURE = "bg-danger";
const SIDEBAR_HEALTH_CLASS_PARTIAL = "bg-muted-foreground/40";
const CONNECTED_LABEL = "connected";
const DISCONNECTED_LABEL = "disconnected";
const READY_LABEL = "ready";
const NOT_READY_LABEL = "not ready";
const OK_LABEL = "ok";

type SidebarHealthState =
  | typeof SIDEBAR_HEALTH_STATE_READY
  | typeof SIDEBAR_HEALTH_STATE_FAILURE
  | typeof SIDEBAR_HEALTH_STATE_PARTIAL;

interface ThreadSidebarRuntimeFooterProps {
  threadSidebarRuntimeSummary: ThreadSidebarRuntimeSummary;
  allSystemsReady: boolean;
  hasAnySystemFailure: boolean;
  commitLabel: string;
  agentDescriptors: ThreadSidebarAgentDescriptor[];
  codexConfigured: boolean;
  healthState: ThreadSidebarPanelHealthState | null;
}

export const ThreadSidebarRuntimeFooter = memo(function ThreadSidebarRuntimeFooter({
  threadSidebarRuntimeSummary,
  allSystemsReady,
  hasAnySystemFailure,
  commitLabel,
  agentDescriptors,
  codexConfigured,
  healthState,
}: ThreadSidebarRuntimeFooterProps): React.JSX.Element {
  return (
    <div className="relative z-20 shrink-0 p-3">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-3 bottom-0 bg-gradient-to-t from-sidebar from-58% via-sidebar/88 via-80% to-transparent to-100%"
      />
      <div className="relative z-10 mb-2 flex flex-wrap gap-2">
        <div
          data-testid="sidebar-runtime-account-summary"
          className="rounded-lg border border-sidebar-border bg-sidebar-accent/30 px-2 py-1 text-[10px] text-muted-foreground"
        >
          {readThreadSidebarAccountSummaryLabel(threadSidebarRuntimeSummary)}
        </div>
        {shouldShowThreadSidebarAppsSummary(threadSidebarRuntimeSummary) && (
          <div
            data-testid="sidebar-runtime-app-summary"
            className="rounded-lg border border-sidebar-border bg-sidebar-accent/30 px-2 py-1 text-[10px] text-muted-foreground"
          >
            {readThreadSidebarAppsSummaryLabel(threadSidebarRuntimeSummary)}
          </div>
        )}
        {shouldShowThreadSidebarProgressSummary(threadSidebarRuntimeSummary) && (
          <div
            data-testid="sidebar-runtime-progress-summary"
            className="rounded-lg border border-sidebar-border bg-sidebar-accent/30 px-2 py-1 text-[10px] text-muted-foreground"
          >
            {readThreadSidebarProgressSummaryLabel(threadSidebarRuntimeSummary)}
          </div>
        )}
        {shouldShowThreadSidebarTokenUsageSummary(threadSidebarRuntimeSummary) && (
          <div
            data-testid="sidebar-runtime-token-usage-summary"
            className="rounded-lg border border-sidebar-border bg-sidebar-accent/30 px-2 py-1 text-[10px] text-muted-foreground"
          >
            {readThreadSidebarTokenUsageSummaryLabel(threadSidebarRuntimeSummary)}
          </div>
        )}
      </div>
      <div className="relative z-10 flex items-center justify-between gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/40 transition-colors cursor-default min-w-0">
              <span
                data-testid="sidebar-health-indicator"
                data-state={readSidebarHealthState(allSystemsReady, hasAnySystemFailure)}
                className={`h-2 w-2 rounded-full shrink-0 ${readSidebarHealthClassName(
                  allSystemsReady,
                  hasAnySystemFailure,
                )}`}
              />
              <span className="font-mono truncate">commit {commitLabel}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" align="start" className="space-y-1 text-xs">
            <div className="font-mono text-[11px]">commit {commitLabel}</div>
            {agentDescriptors
              .filter((descriptor) => descriptor.enabled)
              .map((descriptor) => (
                <div key={descriptor.id}>
                  {descriptor.label}: {descriptor.connected ? CONNECTED_LABEL : DISCONNECTED_LABEL}
                </div>
              ))}
            {codexConfigured ? (
              <>
                <div>App: {healthState?.appReady === true ? OK_LABEL : NOT_READY_LABEL}</div>
                <div>
                  IPC: {healthState?.ipcConnected === true ? CONNECTED_LABEL : DISCONNECTED_LABEL}
                </div>
                <div>
                  Init: {healthState?.ipcInitialized === true ? READY_LABEL : NOT_READY_LABEL}
                </div>
              </>
            ) : null}
            {healthState?.lastError !== undefined &&
              healthState.lastError !== null &&
              healthState.lastError.length > 0 && (
                <div className="max-w-64 break-words text-destructive">
                  Error: {healthState.lastError}
                </div>
              )}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href="https://github.com/achimala/farfield"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open Farfield on GitHub"
              title="Open Farfield on GitHub"
              className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            >
              <Github size={14} aria-hidden="true" />
            </a>
          </TooltipTrigger>
          <TooltipContent side="top" align="end">
            GitHub
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
});

ThreadSidebarRuntimeFooter.displayName = "ThreadSidebarRuntimeFooter";

function readSidebarHealthClassName(
  allSystemsReady: boolean,
  hasAnySystemFailure: boolean,
): string {
  if (allSystemsReady) {
    return SIDEBAR_HEALTH_CLASS_READY;
  }
  if (hasAnySystemFailure) {
    return SIDEBAR_HEALTH_CLASS_FAILURE;
  }
  return SIDEBAR_HEALTH_CLASS_PARTIAL;
}

function readSidebarHealthState(
  allSystemsReady: boolean,
  hasAnySystemFailure: boolean,
): SidebarHealthState {
  if (allSystemsReady) {
    return SIDEBAR_HEALTH_STATE_READY;
  }
  if (hasAnySystemFailure) {
    return SIDEBAR_HEALTH_STATE_FAILURE;
  }
  return SIDEBAR_HEALTH_STATE_PARTIAL;
}

function readThreadSidebarAccountSummaryLabel(summary: ThreadSidebarRuntimeSummary): string {
  if (summary.account === null) {
    return "Account Type n/a";
  }

  if (summary.account.mode === "signedOut") {
    return summary.account.requiresOpenaiAuth ? "Account Type sign in" : "Account Type signed out";
  }

  if (summary.account.mode === "apiKey") {
    return "Account Type API key";
  }

  const planLabel = summary.account.planType ?? "unknown";
  return `Account Type ${planLabel}`;
}

function shouldShowThreadSidebarAppsSummary(summary: ThreadSidebarRuntimeSummary): boolean {
  return summary.apps !== null;
}

function readThreadSidebarAppsSummaryLabel(summary: ThreadSidebarRuntimeSummary): string {
  if (summary.apps === null) {
    return "Apps n/a";
  }
  return `${String(summary.apps.appCount)} Apps`;
}

function shouldShowThreadSidebarProgressSummary(summary: ThreadSidebarRuntimeSummary): boolean {
  return summary.progress !== null;
}

function readThreadSidebarProgressSummaryLabel(summary: ThreadSidebarRuntimeSummary): string {
  if (summary.progress === null) {
    return "Progress n/a";
  }
  return summary.progress.preview ?? summary.progress.method;
}

function shouldShowThreadSidebarTokenUsageSummary(summary: ThreadSidebarRuntimeSummary): boolean {
  return summary.tokenUsage !== null || summary.rateLimits !== null;
}

function readThreadSidebarTokenUsageSummaryLabel(summary: ThreadSidebarRuntimeSummary): string {
  if (summary.tokenUsage !== null && summary.tokenUsage.totalTokens > 0) {
    return `${String(summary.tokenUsage.totalTokens)} Tokens`;
  }
  if (summary.rateLimits?.usedPercent !== null && summary.rateLimits?.usedPercent !== undefined) {
    return `${String(Math.round(summary.rateLimits.usedPercent))}% Used`;
  }
  return "Tokens n/a";
}

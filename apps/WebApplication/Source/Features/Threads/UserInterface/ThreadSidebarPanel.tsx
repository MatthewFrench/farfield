import { Github, PanelLeft, X } from "lucide-react";
import { type AgentId } from "@/Shared/Contracts/ApiContracts";
import { ThreadListPane, type ThreadListPaneProperties } from "./ThreadListPane";
import { Button } from "@/Components/UserInterface/Button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/Components/UserInterface/Tooltip";

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

export interface ThreadSidebarAgentDescriptor {
  id: AgentId;
  label: string;
  enabled: boolean;
  connected: boolean;
}

export interface ThreadSidebarPanelHealthState {
  appReady: boolean;
  ipcConnected: boolean;
  ipcInitialized: boolean;
  lastError: string | null;
}

export interface ThreadSidebarPanelProps {
  viewport: "desktop" | "mobile";
  threadListPaneProperties: ThreadListPaneProperties;
  onHideDesktopSidebar: () => void;
  onCloseMobileSidebar: () => void;
  allSystemsReady: boolean;
  hasAnySystemFailure: boolean;
  commitLabel: string;
  agentDescriptors: ThreadSidebarAgentDescriptor[];
  codexConfigured: boolean;
  healthState: ThreadSidebarPanelHealthState | null;
}

export function ThreadSidebarPanel({
  viewport,
  threadListPaneProperties,
  onHideDesktopSidebar,
  onCloseMobileSidebar,
  allSystemsReady,
  hasAnySystemFailure,
  commitLabel,
  agentDescriptors,
  codexConfigured,
  healthState
}: ThreadSidebarPanelProps): React.JSX.Element {
  return (
    <>
      <div className="relative z-20 h-14 shrink-0 px-4">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -bottom-3 bg-gradient-to-b from-sidebar from-58% via-sidebar/88 via-80% to-transparent to-100%"
        />
        <div className="relative z-10 flex items-center justify-between h-full">
          <span className="text-sm font-semibold">Farfield</span>
          <div className="flex items-center gap-1">
            {viewport === "desktop" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    onClick={onHideDesktopSidebar}
                    data-testid="sidebar-toggle-close"
                    aria-label="Hide sidebar"
                    title="Hide sidebar"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <PanelLeft size={15} aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Hide sidebar</TooltipContent>
              </Tooltip>
            )}
            {viewport === "mobile" && (
              <Button
                type="button"
                onClick={onCloseMobileSidebar}
                data-testid="sidebar-toggle-close"
                aria-label="Close sidebar"
                title="Close sidebar"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
              >
                <X size={14} aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <ThreadListPane {...threadListPaneProperties} />

      <div className="relative z-20 shrink-0 p-3">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-3 bottom-0 bg-gradient-to-t from-sidebar from-58% via-sidebar/88 via-80% to-transparent to-100%"
        />
        <div className="relative z-10 flex items-center justify-between gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/40 transition-colors cursor-default min-w-0">
                <span
                  data-testid="sidebar-health-indicator"
                  data-state={readSidebarHealthState(allSystemsReady, hasAnySystemFailure)}
                  className={`h-2 w-2 rounded-full shrink-0 ${readSidebarHealthClassName(
                    allSystemsReady,
                    hasAnySystemFailure
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
                  <div>IPC: {healthState?.ipcConnected === true ? CONNECTED_LABEL : DISCONNECTED_LABEL}</div>
                  <div>Init: {healthState?.ipcInitialized === true ? READY_LABEL : NOT_READY_LABEL}</div>
                </>
              ) : null}
              {healthState?.lastError !== undefined
                && healthState.lastError !== null
                && healthState.lastError.length > 0 && (
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
            <TooltipContent side="top" align="end">GitHub</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </>
  );
}

function readSidebarHealthClassName(allSystemsReady: boolean, hasAnySystemFailure: boolean): string {
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
  hasAnySystemFailure: boolean
): SidebarHealthState {
  if (allSystemsReady) {
    return SIDEBAR_HEALTH_STATE_READY;
  }
  if (hasAnySystemFailure) {
    return SIDEBAR_HEALTH_STATE_FAILURE;
  }
  return SIDEBAR_HEALTH_STATE_PARTIAL;
}

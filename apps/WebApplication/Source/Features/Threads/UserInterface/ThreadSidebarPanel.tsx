import { Github, PanelLeft, X } from "lucide-react";
import { type AgentId } from "@/Shared/Contracts/ApiContracts";
import { ThreadListPane, type ThreadListPaneProperties } from "./ThreadListPane";
import { Button } from "@/Components/UserInterface/Button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/Components/UserInterface/Tooltip";

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
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <PanelLeft size={15} />
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
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
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
                  className={`h-2 w-2 rounded-full shrink-0 ${
                    allSystemsReady
                      ? "bg-success"
                      : hasAnySystemFailure
                        ? "bg-danger"
                        : "bg-muted-foreground/40"
                  }`}
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
                    {descriptor.label}: {descriptor.connected ? "connected" : "disconnected"}
                  </div>
                ))}
              {codexConfigured ? (
                <>
                  <div>App: {healthState?.appReady ? "ok" : "not ready"}</div>
                  <div>IPC: {healthState?.ipcConnected ? "connected" : "disconnected"}</div>
                  <div>Init: {healthState?.ipcInitialized ? "ready" : "not ready"}</div>
                </>
              ) : null}
              {healthState?.lastError && (
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
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
              >
                <Github size={14} />
              </a>
            </TooltipTrigger>
            <TooltipContent side="top" align="end">GitHub</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </>
  );
}

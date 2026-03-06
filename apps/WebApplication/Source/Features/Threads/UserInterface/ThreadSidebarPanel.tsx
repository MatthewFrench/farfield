import { PanelLeft, X } from "lucide-react";
import { memo } from "react";
import { Button } from "@/Components/UserInterface/Button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/Components/UserInterface/Tooltip";
import { type ThreadSidebarRuntimeSummary } from "@/Features/Threads/DomainModel/ThreadRuntimeStatusContracts";
import { type AgentId } from "@/Shared/Contracts/ApiContracts";
import { ThreadListPane, type ThreadListPaneProperties } from "./ThreadListPane";
import { ThreadSidebarRuntimeFooter } from "./ThreadSidebarRuntimeFooter";

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
  threadSidebarRuntimeSummary: ThreadSidebarRuntimeSummary;
  onHideDesktopSidebar: () => void;
  onCloseMobileSidebar: () => void;
  allSystemsReady: boolean;
  hasAnySystemFailure: boolean;
  commitLabel: string;
  agentDescriptors: ThreadSidebarAgentDescriptor[];
  codexConfigured: boolean;
  healthState: ThreadSidebarPanelHealthState | null;
}

export const ThreadSidebarPanel = memo(function ThreadSidebarPanel({
  viewport,
  threadListPaneProperties,
  threadSidebarRuntimeSummary,
  onHideDesktopSidebar,
  onCloseMobileSidebar,
  allSystemsReady,
  hasAnySystemFailure,
  commitLabel,
  agentDescriptors,
  codexConfigured,
  healthState,
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

      <ThreadSidebarRuntimeFooter
        threadSidebarRuntimeSummary={threadSidebarRuntimeSummary}
        allSystemsReady={allSystemsReady}
        hasAnySystemFailure={hasAnySystemFailure}
        commitLabel={commitLabel}
        agentDescriptors={agentDescriptors}
        codexConfigured={codexConfigured}
        healthState={healthState}
      />
    </>
  );
});

ThreadSidebarPanel.displayName = "ThreadSidebarPanel";

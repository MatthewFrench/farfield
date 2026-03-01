import { Loader2, Menu, Moon, PanelLeft, RefreshCcw, Settings2, Sun } from "lucide-react";
import { Button } from "@/Components/UserInterface/Button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/Components/UserInterface/Tooltip";
import {
  type ThreadRuntimeModelRerouteSummary,
  type ThreadRuntimeWarningSummary,
} from "@/Features/Threads/DomainModel/ThreadRuntimeStatusContracts";
import { type AgentId } from "@/Shared/Contracts/ApiContracts";

const DEBUG_TAB = "debug";
const CHAT_TAB = "chat";

function readHeaderIconButtonClassName(active: boolean | undefined): string {
  if (active === true) {
    return "h-8 w-8 rounded-lg bg-muted text-foreground hover:bg-muted";
  }
  return "h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted";
}

interface HeaderIconButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  active?: boolean;
  testId?: string;
  children: React.ReactNode;
}

function HeaderIconButton({
  onClick,
  disabled,
  title,
  active,
  testId,
  children,
}: HeaderIconButtonProps): React.JSX.Element {
  const buttonNode = (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      aria-label={title}
      title={title}
      variant="ghost"
      size="icon"
      className={readHeaderIconButtonClassName(active)}
    >
      {children}
    </Button>
  );

  if (title === undefined || title.length === 0) {
    return buttonNode;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{buttonNode}</TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
}

export type ApplicationHeaderBarTab = "chat" | "debug";

export interface ApplicationHeaderBarProps {
  activeTab: ApplicationHeaderBarTab;
  desktopSidebarOpen: boolean;
  selectedThreadLabel: string;
  hasSelectedThread: boolean;
  activeThreadAgentId: AgentId;
  activeAgentLabel: string;
  isGenerating: boolean;
  runtimeWarningSummary: ThreadRuntimeWarningSummary | null;
  runtimeModelRerouteSummary: ThreadRuntimeModelRerouteSummary | null;
  isBusy: boolean;
  theme: string;
  onOpenMobileSidebar: () => void;
  onOpenDesktopSidebar: () => void;
  onRefresh: () => void;
  onToggleSettingsTab: () => void;
  onToggleTheme: () => void;
  renderAgentFavicon: (agentId: AgentId, label: string, className: string) => React.ReactNode;
}

function readModelRerouteBannerLabel(summary: ThreadRuntimeModelRerouteSummary): string {
  return `Model rerouted ${summary.fromModel} -> ${summary.toModel}`;
}

function readRuntimeWarningBannerLabel(summary: ThreadRuntimeWarningSummary): string {
  if (summary.method === "thread/realtime/started" || summary.method === "thread/realtime/closed") {
    return `Realtime: ${summary.summary}`;
  }
  const prefix = summary.method === "error" ? "Error" : "Warning";
  const retrySuffix = summary.isRetrying ? " (retrying)" : "";
  return `${prefix}: ${summary.summary}${retrySuffix}`;
}

function readRuntimeWarningBannerClassName(summary: ThreadRuntimeWarningSummary): string {
  if (summary.method === "error") {
    return "text-[11px] text-red-500";
  }
  if (summary.method === "thread/realtime/started" || summary.method === "thread/realtime/closed") {
    return "text-[11px] text-sky-500";
  }
  return "text-[11px] text-amber-500";
}

function buildSidebarOpenHandler(
  onOpenSidebar: () => void,
  activeTab: ApplicationHeaderBarTab,
  onToggleSettingsTab: () => void,
): () => void {
  return () => {
    onOpenSidebar();
    if (activeTab === DEBUG_TAB) {
      onToggleSettingsTab();
    }
  };
}

function readHeaderContainerClassName(activeTab: ApplicationHeaderBarTab): string {
  return `flex items-center justify-between px-3 h-14 shrink-0 gap-2 ${
    activeTab === CHAT_TAB
      ? "absolute inset-x-0 top-0 z-20 bg-transparent"
      : "border-b border-border"
  }`;
}

export function ApplicationHeaderBar({
  activeTab,
  desktopSidebarOpen,
  selectedThreadLabel,
  hasSelectedThread,
  activeThreadAgentId,
  activeAgentLabel,
  isGenerating,
  runtimeWarningSummary,
  runtimeModelRerouteSummary,
  isBusy,
  theme,
  onOpenMobileSidebar,
  onOpenDesktopSidebar,
  onRefresh,
  onToggleSettingsTab,
  onToggleTheme,
  renderAgentFavicon,
}: ApplicationHeaderBarProps): React.JSX.Element {
  const handleOpenMobileSidebar = buildSidebarOpenHandler(
    onOpenMobileSidebar,
    activeTab,
    onToggleSettingsTab,
  );
  const handleOpenDesktopSidebar = buildSidebarOpenHandler(
    onOpenDesktopSidebar,
    activeTab,
    onToggleSettingsTab,
  );

  return (
    <header className={readHeaderContainerClassName(activeTab)}>
      <div className="flex items-center gap-2 min-w-0">
        <div className="md:hidden">
          <HeaderIconButton
            onClick={handleOpenMobileSidebar}
            title="Threads"
            testId="sidebar-toggle-open"
          >
            <Menu size={15} aria-hidden="true" />
          </HeaderIconButton>
        </div>
        {!desktopSidebarOpen && (
          <div className="hidden md:block">
            <HeaderIconButton
              onClick={handleOpenDesktopSidebar}
              title="Show sidebar"
              testId="sidebar-toggle-open"
            >
              <PanelLeft size={15} aria-hidden="true" />
            </HeaderIconButton>
          </div>
        )}
        <div className="min-w-0">
          <div
            data-testid="selected-thread-label"
            className="text-sm font-medium truncate leading-5 flex items-center gap-1.5"
          >
            {selectedThreadLabel}
            {hasSelectedThread && activeAgentLabel.length > 0 && (
              <span className="shrink-0 h-5 w-5 rounded-md bg-muted/30 ring-1 ring-border/60 flex items-center justify-center overflow-hidden">
                {renderAgentFavicon(activeThreadAgentId, activeAgentLabel, "h-4 w-4")}
              </span>
            )}
          </div>
          {isGenerating && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Loader2 size={9} className="animate-spin" />
              <span>generating</span>
            </div>
          )}
          {runtimeWarningSummary !== null && (
            <div
              data-testid="header-runtime-warning-banner"
              className={readRuntimeWarningBannerClassName(runtimeWarningSummary)}
            >
              {readRuntimeWarningBannerLabel(runtimeWarningSummary)}
            </div>
          )}
          {runtimeModelRerouteSummary !== null && (
            <div
              data-testid="header-runtime-model-reroute-banner"
              className="text-[11px] text-muted-foreground"
            >
              {readModelRerouteBannerLabel(runtimeModelRerouteSummary)}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        <HeaderIconButton
          onClick={onRefresh}
          disabled={isBusy}
          title="Refresh"
          testId="refresh-button"
        >
          <RefreshCcw size={14} className={isBusy ? "animate-spin" : ""} aria-hidden="true" />
        </HeaderIconButton>
        <HeaderIconButton
          onClick={onToggleSettingsTab}
          active={activeTab === DEBUG_TAB}
          title="Settings"
          testId="tab-settings"
        >
          <Settings2 size={14} aria-hidden="true" />
        </HeaderIconButton>
        <HeaderIconButton onClick={onToggleTheme} title="Toggle theme">
          {theme === "dark" ? (
            <Sun size={14} aria-hidden="true" />
          ) : (
            <Moon size={14} aria-hidden="true" />
          )}
        </HeaderIconButton>
      </div>
    </header>
  );
}

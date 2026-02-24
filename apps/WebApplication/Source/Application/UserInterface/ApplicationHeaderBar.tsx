import { Bug, Loader2, Menu, Moon, PanelLeft, RefreshCcw, Sun } from "lucide-react";
import { type AgentId } from "@/Shared/Contracts/ApiContracts";
import { type PushClientState } from "@/Features/PushNotifications/DomainModel/PushClientContracts";
import { PushStatusButton } from "@/Features/PushNotifications/UserInterface/PushStatusButton";
import { Button } from "@/Components/UserInterface/Button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/Components/UserInterface/Tooltip";

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
  children
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
      className={`h-8 w-8 rounded-lg ${
        active
          ? "bg-muted text-foreground hover:bg-muted"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      {children}
    </Button>
  );

  if (!title) {
    return buttonNode;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{buttonNode}</TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
}

export interface ApplicationHeaderBarProps {
  activeTab: "chat" | "debug";
  desktopSidebarOpen: boolean;
  selectedThreadLabel: string;
  hasSelectedThread: boolean;
  activeThreadAgentId: AgentId;
  activeAgentLabel: string;
  isGenerating: boolean;
  pushClientState: PushClientState;
  isEnablingPushNotifications: boolean;
  isBusy: boolean;
  theme: string;
  onOpenMobileSidebar: () => void;
  onOpenDesktopSidebar: () => void;
  onEnablePushNotifications: () => void;
  onRefresh: () => void;
  onToggleDebugTab: () => void;
  onToggleTheme: () => void;
  renderAgentFavicon: (agentId: AgentId, label: string, className: string) => React.ReactNode;
}

export function ApplicationHeaderBar({
  activeTab,
  desktopSidebarOpen,
  selectedThreadLabel,
  hasSelectedThread,
  activeThreadAgentId,
  activeAgentLabel,
  isGenerating,
  pushClientState,
  isEnablingPushNotifications,
  isBusy,
  theme,
  onOpenMobileSidebar,
  onOpenDesktopSidebar,
  onEnablePushNotifications,
  onRefresh,
  onToggleDebugTab,
  onToggleTheme,
  renderAgentFavicon
}: ApplicationHeaderBarProps): React.JSX.Element {
  return (
    <header
      className={`flex items-center justify-between px-3 h-14 shrink-0 gap-2 ${
        activeTab === "chat"
          ? "absolute inset-x-0 top-0 z-20 bg-transparent"
          : "border-b border-border"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="md:hidden">
          <HeaderIconButton
            onClick={onOpenMobileSidebar}
            title="Threads"
            testId="sidebar-toggle-open"
          >
            <Menu size={15} aria-hidden="true" />
          </HeaderIconButton>
        </div>
        {!desktopSidebarOpen && (
          <div className="hidden md:block">
            <HeaderIconButton
              onClick={onOpenDesktopSidebar}
              title="Show sidebar"
              testId="sidebar-toggle-open"
            >
              <PanelLeft size={15} aria-hidden="true" />
            </HeaderIconButton>
          </div>
        )}
        <div className="min-w-0">
          <div data-testid="selected-thread-label" className="text-sm font-medium truncate leading-5 flex items-center gap-1.5">
            {selectedThreadLabel}
            {hasSelectedThread && activeAgentLabel && (
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
        </div>
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        <PushStatusButton
          pushClientState={pushClientState}
          isEnablingPushNotifications={isEnablingPushNotifications}
          onEnablePushNotifications={onEnablePushNotifications}
        />
        <HeaderIconButton
          onClick={onRefresh}
          disabled={isBusy}
          title="Refresh"
          testId="refresh-button"
        >
          <RefreshCcw size={14} className={isBusy ? "animate-spin" : ""} aria-hidden="true" />
        </HeaderIconButton>
        <HeaderIconButton
          onClick={onToggleDebugTab}
          active={activeTab === "debug"}
          title="Debug"
          testId="tab-debug"
        >
          <Bug size={14} aria-hidden="true" />
        </HeaderIconButton>
        <HeaderIconButton onClick={onToggleTheme} title="Toggle theme">
          {theme === "dark" ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
        </HeaderIconButton>
      </div>
    </header>
  );
}

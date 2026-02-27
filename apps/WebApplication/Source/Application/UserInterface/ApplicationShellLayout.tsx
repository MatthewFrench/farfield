import { AnimatePresence, motion } from "framer-motion";
import { type TouchEvent as ReactTouchEvent } from "react";
import {
  ApiSessionBootstrapOverlay,
  type ApiSessionBootstrapOverlayProperties,
} from "@/Application/UserInterface/ApiSessionBootstrapOverlay";
import {
  ApplicationHeaderBar,
  type ApplicationHeaderBarProps,
} from "@/Application/UserInterface/ApplicationHeaderBar";
import {
  ChatWorkspacePane,
  type ChatWorkspacePaneProps,
} from "@/Features/Chat/UserInterface/ChatWorkspacePane";
import {
  DebugStatusBanners,
  type DebugStatusBannersProps,
} from "@/Features/Debugging/UserInterface/DebugStatusBanners";
import {
  DebugWorkspacePane,
  type DebugWorkspacePaneProps,
} from "@/Features/Debugging/UserInterface/DebugWorkspacePane";
import { type ThreadListPaneProperties } from "@/Features/Threads/UserInterface/ThreadListPane";
import {
  type ThreadSidebarAgentDescriptor,
  type ThreadSidebarPanelHealthState,
} from "@/Features/Threads/UserInterface/ThreadSidebarPanel";
import { ThreadSidebarViewport } from "@/Features/Threads/UserInterface/ThreadSidebarViewport";

export type ApplicationShellActiveTab = "chat" | "debug";

export interface ApplicationShellLayoutProps {
  applicationShellElementRef: React.RefObject<HTMLDivElement | null>;
  onAppShellTouchStart: (event: ReactTouchEvent<HTMLDivElement>) => void;
  onAppShellTouchMove: (event: ReactTouchEvent<HTMLDivElement>) => void;
  onEndSidebarSwipeTracking: () => void;
  mobileSidebarOpen: boolean;
  desktopSidebarOpen: boolean;
  onCloseMobileSidebar: () => void;
  onHideDesktopSidebar: () => void;
  threadListPaneProperties: ThreadListPaneProperties;
  allSystemsReady: boolean;
  hasAnySystemFailure: boolean;
  commitLabel: string;
  agentDescriptors: ThreadSidebarAgentDescriptor[];
  codexConfigured: boolean;
  threadSidebarHealthState: ThreadSidebarPanelHealthState | null;
  activeTab: ApplicationShellActiveTab;
  applicationHeaderBarProperties: ApplicationHeaderBarProps;
  debugStatusBannersProperties: DebugStatusBannersProps;
  chatWorkspacePaneProperties: ChatWorkspacePaneProps;
  debugWorkspacePaneProperties: DebugWorkspacePaneProps;
  showApiSessionBootstrapOverlay: boolean;
  apiSessionBootstrapOverlayProperties: ApiSessionBootstrapOverlayProperties;
}

export function ApplicationShellLayout({
  applicationShellElementRef,
  onAppShellTouchStart,
  onAppShellTouchMove,
  onEndSidebarSwipeTracking,
  mobileSidebarOpen,
  desktopSidebarOpen,
  onCloseMobileSidebar,
  onHideDesktopSidebar,
  threadListPaneProperties,
  allSystemsReady,
  hasAnySystemFailure,
  commitLabel,
  agentDescriptors,
  codexConfigured,
  threadSidebarHealthState,
  activeTab,
  applicationHeaderBarProperties,
  debugStatusBannersProperties,
  chatWorkspacePaneProperties,
  debugWorkspacePaneProperties,
  showApiSessionBootstrapOverlay,
  apiSessionBootstrapOverlayProperties,
}: ApplicationShellLayoutProps): React.JSX.Element {
  const threadSidebarViewportSharedProperties = {
    threadListPaneProperties,
    onHideDesktopSidebar,
    onCloseMobileSidebar,
    allSystemsReady,
    hasAnySystemFailure,
    commitLabel,
    agentDescriptors,
    codexConfigured,
    healthState: threadSidebarHealthState,
  };

  return (
    <div
      ref={applicationShellElementRef}
      data-testid="app-shell"
      className="app-shell flex bg-background text-foreground font-sans"
      onTouchStart={onAppShellTouchStart}
      onTouchMove={onAppShellTouchMove}
      onTouchEnd={onEndSidebarSwipeTracking}
      onTouchCancel={onEndSidebarSwipeTracking}
    >
      <AnimatePresence>
        {mobileSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            data-testid="sidebar-backdrop"
            className="md:hidden fixed inset-0 bg-black/50 z-40"
            onClick={onCloseMobileSidebar}
          />
        )}
      </AnimatePresence>

      <ThreadSidebarViewport
        viewport="desktop"
        isOpen={desktopSidebarOpen}
        {...threadSidebarViewportSharedProperties}
      />

      <ThreadSidebarViewport
        viewport="mobile"
        isOpen={mobileSidebarOpen}
        {...threadSidebarViewportSharedProperties}
      />

      <div
        className={`relative flex-1 flex flex-col min-w-0 transition-[margin] duration-200 ${
          desktopSidebarOpen ? "md:ml-64" : "md:ml-0"
        } h-full overflow-hidden`}
      >
        <ApplicationHeaderBar {...applicationHeaderBarProperties} />

        <DebugStatusBanners {...debugStatusBannersProperties} />

        {activeTab === "chat" && <ChatWorkspacePane {...chatWorkspacePaneProperties} />}

        {activeTab === "debug" && <DebugWorkspacePane {...debugWorkspacePaneProperties} />}

        {showApiSessionBootstrapOverlay && (
          <ApiSessionBootstrapOverlay {...apiSessionBootstrapOverlayProperties} />
        )}
      </div>
    </div>
  );
}

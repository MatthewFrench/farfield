import { type TouchEvent as ReactTouchEvent } from "react";
import {
  ApplicationShellMainRegion,
  type ApplicationShellMainRegionProps,
} from "@/Application/UserInterface/ApplicationShellMainRegion";
import {
  ApplicationShellSidebarRegion,
  type ApplicationShellSidebarRegionProps,
} from "@/Application/UserInterface/ApplicationShellSidebarRegion";
import { type ThreadSidebarRuntimeSummary } from "@/Features/Threads/DomainModel/ThreadRuntimeStatusContracts";
import { type ThreadListPaneProperties } from "@/Features/Threads/UserInterface/ThreadListPane";
import {
  type ThreadSidebarAgentDescriptor,
  type ThreadSidebarPanelHealthState,
} from "@/Features/Threads/UserInterface/ThreadSidebarPanel";

export type ApplicationShellActiveTab = "chat" | "debug";

export interface ApplicationShellLayoutProps
  extends ApplicationShellSidebarRegionProps,
    ApplicationShellMainRegionProps {
  applicationShellElementRef: React.RefObject<HTMLDivElement | null>;
  onAppShellTouchStart: (event: ReactTouchEvent<HTMLDivElement>) => void;
  onAppShellTouchMove: (event: ReactTouchEvent<HTMLDivElement>) => void;
  onEndSidebarSwipeTracking: () => void;
}

export function ApplicationShellLayout({
  applicationShellElementRef,
  onAppShellTouchStart,
  onAppShellTouchMove,
  onEndSidebarSwipeTracking,
  isMobileLayout,
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
  threadSidebarRuntimeSummary,
  activeTab,
  applicationHeaderBarProperties,
  debugStatusBannersProperties,
  chatWorkspacePaneProperties,
  settingsWorkspacePaneProperties,
  showApiSessionBootstrapOverlay,
  apiSessionBootstrapOverlayProperties,
}: ApplicationShellLayoutProps): React.JSX.Element {
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
      <ApplicationShellSidebarRegion
        isMobileLayout={isMobileLayout}
        mobileSidebarOpen={mobileSidebarOpen}
        desktopSidebarOpen={desktopSidebarOpen}
        onCloseMobileSidebar={onCloseMobileSidebar}
        onHideDesktopSidebar={onHideDesktopSidebar}
        threadListPaneProperties={threadListPaneProperties}
        allSystemsReady={allSystemsReady}
        hasAnySystemFailure={hasAnySystemFailure}
        commitLabel={commitLabel}
        agentDescriptors={agentDescriptors}
        codexConfigured={codexConfigured}
        threadSidebarHealthState={threadSidebarHealthState}
        threadSidebarRuntimeSummary={threadSidebarRuntimeSummary}
      />

      <ApplicationShellMainRegion
        isMobileLayout={isMobileLayout}
        desktopSidebarOpen={desktopSidebarOpen}
        activeTab={activeTab}
        applicationHeaderBarProperties={applicationHeaderBarProperties}
        debugStatusBannersProperties={debugStatusBannersProperties}
        chatWorkspacePaneProperties={chatWorkspacePaneProperties}
        settingsWorkspacePaneProperties={settingsWorkspacePaneProperties}
        showApiSessionBootstrapOverlay={showApiSessionBootstrapOverlay}
        apiSessionBootstrapOverlayProperties={apiSessionBootstrapOverlayProperties}
      />
    </div>
  );
}

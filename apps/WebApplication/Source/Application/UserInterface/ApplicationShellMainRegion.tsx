import { memo, useEffect, useRef } from "react";
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
  SettingsWorkspacePane,
  type SettingsWorkspacePaneProps,
} from "@/Features/Settings/UserInterface/SettingsWorkspacePane";
import { recordGlobalPerformanceInstantEvent } from "@/Shared/Performance/ClientPerformanceFreezeProbeOwner";
import { type ApplicationShellActiveTab } from "./ApplicationShellLayout";

export interface ApplicationShellMainRegionProps {
  isMobileLayout: boolean;
  desktopSidebarOpen: boolean;
  activeTab: ApplicationShellActiveTab;
  applicationHeaderBarProperties: ApplicationHeaderBarProps;
  debugStatusBannersProperties: DebugStatusBannersProps;
  chatWorkspacePaneProperties: ChatWorkspacePaneProps;
  settingsWorkspacePaneProperties: SettingsWorkspacePaneProps;
  showApiSessionBootstrapOverlay: boolean;
  apiSessionBootstrapOverlayProperties: ApiSessionBootstrapOverlayProperties;
}

interface ApplicationShellMainRegionRenderSnapshot {
  isMobileLayout: boolean;
  desktopSidebarOpen: boolean;
  activeTab: ApplicationShellActiveTab;
  applicationHeaderBarProperties: ApplicationHeaderBarProps;
  debugStatusBannersProperties: DebugStatusBannersProps;
  chatWorkspacePaneProperties: ChatWorkspacePaneProps;
  settingsWorkspacePaneProperties: SettingsWorkspacePaneProps;
  showApiSessionBootstrapOverlay: boolean;
  apiSessionBootstrapOverlayProperties: ApiSessionBootstrapOverlayProperties;
}

function readApplicationShellMainRegionChangedFields(
  previousSnapshot: ApplicationShellMainRegionRenderSnapshot | null,
  nextSnapshot: ApplicationShellMainRegionRenderSnapshot,
): string[] {
  if (previousSnapshot === null) {
    return ["initial-render"];
  }

  const changedFields: string[] = [];
  if (previousSnapshot.isMobileLayout !== nextSnapshot.isMobileLayout) {
    changedFields.push("isMobileLayout");
  }
  if (previousSnapshot.desktopSidebarOpen !== nextSnapshot.desktopSidebarOpen) {
    changedFields.push("desktopSidebarOpen");
  }
  if (previousSnapshot.activeTab !== nextSnapshot.activeTab) {
    changedFields.push("activeTab");
  }
  if (
    previousSnapshot.applicationHeaderBarProperties !== nextSnapshot.applicationHeaderBarProperties
  ) {
    changedFields.push("applicationHeaderBarProperties");
  }
  if (previousSnapshot.debugStatusBannersProperties !== nextSnapshot.debugStatusBannersProperties) {
    changedFields.push("debugStatusBannersProperties");
  }
  if (previousSnapshot.chatWorkspacePaneProperties !== nextSnapshot.chatWorkspacePaneProperties) {
    changedFields.push("chatWorkspacePaneProperties");
  }
  if (
    previousSnapshot.settingsWorkspacePaneProperties !==
    nextSnapshot.settingsWorkspacePaneProperties
  ) {
    changedFields.push("settingsWorkspacePaneProperties");
  }
  if (
    previousSnapshot.showApiSessionBootstrapOverlay !== nextSnapshot.showApiSessionBootstrapOverlay
  ) {
    changedFields.push("showApiSessionBootstrapOverlay");
  }
  if (
    previousSnapshot.apiSessionBootstrapOverlayProperties !==
    nextSnapshot.apiSessionBootstrapOverlayProperties
  ) {
    changedFields.push("apiSessionBootstrapOverlayProperties");
  }

  if (changedFields.length === 0) {
    changedFields.push("stable-props-parent-rerender");
  }

  return changedFields;
}

export const ApplicationShellMainRegion = memo(function ApplicationShellMainRegion({
  isMobileLayout,
  desktopSidebarOpen,
  activeTab,
  applicationHeaderBarProperties,
  debugStatusBannersProperties,
  chatWorkspacePaneProperties,
  settingsWorkspacePaneProperties,
  showApiSessionBootstrapOverlay,
  apiSessionBootstrapOverlayProperties,
}: ApplicationShellMainRegionProps): React.JSX.Element {
  const previousRenderSnapshotReference = useRef<ApplicationShellMainRegionRenderSnapshot | null>(
    null,
  );

  useEffect(() => {
    const nextSnapshot: ApplicationShellMainRegionRenderSnapshot = {
      isMobileLayout,
      desktopSidebarOpen,
      activeTab,
      applicationHeaderBarProperties,
      debugStatusBannersProperties,
      chatWorkspacePaneProperties,
      settingsWorkspacePaneProperties,
      showApiSessionBootstrapOverlay,
      apiSessionBootstrapOverlayProperties,
    };
    const changedFields = readApplicationShellMainRegionChangedFields(
      previousRenderSnapshotReference.current,
      nextSnapshot,
    );
    previousRenderSnapshotReference.current = nextSnapshot;
    recordGlobalPerformanceInstantEvent("application-shell-main-region-committed", {
      activeTab,
      changedFields,
      desktopSidebarOpen,
      showApiSessionBootstrapOverlay,
    });
  }, [
    isMobileLayout,
    desktopSidebarOpen,
    activeTab,
    applicationHeaderBarProperties,
    debugStatusBannersProperties,
    chatWorkspacePaneProperties,
    settingsWorkspacePaneProperties,
    showApiSessionBootstrapOverlay,
    apiSessionBootstrapOverlayProperties,
  ]);

  return (
    <div
      className={`relative flex-1 flex flex-col min-w-0 transition-[margin] duration-200 ${
        !isMobileLayout && desktopSidebarOpen ? "md:ml-64" : "md:ml-0"
      } h-full overflow-hidden`}
    >
      <ApplicationHeaderBar {...applicationHeaderBarProperties} />

      <DebugStatusBanners {...debugStatusBannersProperties} />

      {activeTab === "chat" && <ChatWorkspacePane {...chatWorkspacePaneProperties} />}

      {activeTab === "debug" && <SettingsWorkspacePane {...settingsWorkspacePaneProperties} />}

      {showApiSessionBootstrapOverlay && (
        <ApiSessionBootstrapOverlay {...apiSessionBootstrapOverlayProperties} />
      )}
    </div>
  );
});

ApplicationShellMainRegion.displayName = "ApplicationShellMainRegion";

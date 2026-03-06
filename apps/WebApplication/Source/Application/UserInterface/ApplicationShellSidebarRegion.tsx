import { memo, useEffect, useRef } from "react";
import { type ThreadSidebarRuntimeSummary } from "@/Features/Threads/DomainModel/ThreadRuntimeStatusContracts";
import { type ThreadListPaneProperties } from "@/Features/Threads/UserInterface/ThreadListPane";
import {
  type ThreadSidebarAgentDescriptor,
  type ThreadSidebarPanelHealthState,
} from "@/Features/Threads/UserInterface/ThreadSidebarPanel";
import { ThreadSidebarViewport } from "@/Features/Threads/UserInterface/ThreadSidebarViewport";
import { recordGlobalPerformanceInstantEvent } from "@/Shared/Performance/ClientPerformanceFreezeProbeOwner";

export interface ApplicationShellSidebarRegionProps {
  isMobileLayout: boolean;
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
  threadSidebarRuntimeSummary: ThreadSidebarRuntimeSummary;
}

interface ApplicationShellSidebarRegionRenderSnapshot {
  isMobileLayout: boolean;
  mobileSidebarOpen: boolean;
  desktopSidebarOpen: boolean;
  threadListPaneProperties: ThreadListPaneProperties;
  allSystemsReady: boolean;
  hasAnySystemFailure: boolean;
  commitLabel: string;
  agentDescriptors: ThreadSidebarAgentDescriptor[];
  codexConfigured: boolean;
  threadSidebarHealthState: ThreadSidebarPanelHealthState | null;
  threadSidebarRuntimeSummary: ThreadSidebarRuntimeSummary;
}

function readApplicationShellSidebarRegionChangedFields(
  previousSnapshot: ApplicationShellSidebarRegionRenderSnapshot | null,
  nextSnapshot: ApplicationShellSidebarRegionRenderSnapshot,
): string[] {
  if (previousSnapshot === null) {
    return ["initial-render"];
  }

  const changedFields: string[] = [];
  if (previousSnapshot.isMobileLayout !== nextSnapshot.isMobileLayout) {
    changedFields.push("isMobileLayout");
  }
  if (previousSnapshot.mobileSidebarOpen !== nextSnapshot.mobileSidebarOpen) {
    changedFields.push("mobileSidebarOpen");
  }
  if (previousSnapshot.desktopSidebarOpen !== nextSnapshot.desktopSidebarOpen) {
    changedFields.push("desktopSidebarOpen");
  }
  if (previousSnapshot.threadListPaneProperties !== nextSnapshot.threadListPaneProperties) {
    changedFields.push("threadListPaneProperties");
  }
  if (previousSnapshot.allSystemsReady !== nextSnapshot.allSystemsReady) {
    changedFields.push("allSystemsReady");
  }
  if (previousSnapshot.hasAnySystemFailure !== nextSnapshot.hasAnySystemFailure) {
    changedFields.push("hasAnySystemFailure");
  }
  if (previousSnapshot.commitLabel !== nextSnapshot.commitLabel) {
    changedFields.push("commitLabel");
  }
  if (previousSnapshot.agentDescriptors !== nextSnapshot.agentDescriptors) {
    changedFields.push("agentDescriptors");
  }
  if (previousSnapshot.codexConfigured !== nextSnapshot.codexConfigured) {
    changedFields.push("codexConfigured");
  }
  if (previousSnapshot.threadSidebarHealthState !== nextSnapshot.threadSidebarHealthState) {
    changedFields.push("threadSidebarHealthState");
  }
  if (previousSnapshot.threadSidebarRuntimeSummary !== nextSnapshot.threadSidebarRuntimeSummary) {
    changedFields.push("threadSidebarRuntimeSummary");
  }

  if (changedFields.length === 0) {
    changedFields.push("stable-props-parent-rerender");
  }

  return changedFields;
}

export const ApplicationShellSidebarRegion = memo(function ApplicationShellSidebarRegion({
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
}: ApplicationShellSidebarRegionProps): React.JSX.Element {
  const previousRenderSnapshotReference =
    useRef<ApplicationShellSidebarRegionRenderSnapshot | null>(null);

  useEffect(() => {
    const nextSnapshot: ApplicationShellSidebarRegionRenderSnapshot = {
      isMobileLayout,
      mobileSidebarOpen,
      desktopSidebarOpen,
      threadListPaneProperties,
      allSystemsReady,
      hasAnySystemFailure,
      commitLabel,
      agentDescriptors,
      codexConfigured,
      threadSidebarHealthState,
      threadSidebarRuntimeSummary,
    };
    const changedFields = readApplicationShellSidebarRegionChangedFields(
      previousRenderSnapshotReference.current,
      nextSnapshot,
    );
    previousRenderSnapshotReference.current = nextSnapshot;
    recordGlobalPerformanceInstantEvent("application-shell-sidebar-region-committed", {
      changedFields,
      isMobileLayout,
      mobileSidebarOpen,
      desktopSidebarOpen,
    });
  }, [
    isMobileLayout,
    mobileSidebarOpen,
    desktopSidebarOpen,
    threadListPaneProperties,
    allSystemsReady,
    hasAnySystemFailure,
    commitLabel,
    agentDescriptors,
    codexConfigured,
    threadSidebarHealthState,
    threadSidebarRuntimeSummary,
  ]);

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
    threadSidebarRuntimeSummary,
  };

  return (
    <>
      {isMobileLayout && (
        <div
          data-testid="sidebar-backdrop"
          className={`md:hidden fixed inset-0 z-40 bg-black/50 transition-opacity duration-150 ease-out ${
            mobileSidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
          onClick={onCloseMobileSidebar}
        />
      )}

      {!isMobileLayout && (
        <ThreadSidebarViewport
          viewport="desktop"
          isOpen={desktopSidebarOpen}
          {...threadSidebarViewportSharedProperties}
        />
      )}

      {isMobileLayout && (
        <ThreadSidebarViewport
          viewport="mobile"
          isOpen={mobileSidebarOpen}
          {...threadSidebarViewportSharedProperties}
        />
      )}
    </>
  );
});

ApplicationShellSidebarRegion.displayName = "ApplicationShellSidebarRegion";

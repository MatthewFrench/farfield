import { memo, useEffect } from "react";
import { recordGlobalPerformanceInstantEvent } from "@/Shared/Performance/ClientPerformanceFreezeProbeOwner";
import { ThreadSidebarPanel, type ThreadSidebarPanelProps } from "./ThreadSidebarPanel";

interface ThreadSidebarViewportProps extends Omit<ThreadSidebarPanelProps, "viewport"> {
  viewport: "desktop" | "mobile";
  isOpen: boolean;
}

// The closed translation distance intentionally exceeds `w-64` (256px) so the border/shadow
// are fully outside the viewport during hidden states.
const SIDEBAR_CLOSED_TRANSLATE_X_PIXELS = -280;
const SIDEBAR_CLOSED_OPACITY = 0.94;
const SIDEBAR_DESKTOP_TRANSITION_CLASS_NAME =
  "transition-transform transition-opacity duration-150 ease-out";
const SIDEBAR_MOBILE_TRANSITION_CLASS_NAME = "transition-transform duration-150 ease-out";

export const ThreadSidebarViewport = memo(function ThreadSidebarViewport({
  viewport,
  isOpen,
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
}: ThreadSidebarViewportProps): React.JSX.Element {
  // Keep the sidebar tree mounted so row identity, scroll position, and expensive descendants
  // survive open/close transitions instead of remounting on first reveal.
  useEffect(() => {
    if (isOpen) {
      recordGlobalPerformanceInstantEvent("sidebar-viewport-visible", {
        viewport,
      });
    }
  }, [isOpen, viewport]);

  if (viewport === "desktop") {
    return (
      <aside
        data-testid="sidebar-desktop"
        aria-hidden={!isOpen}
        className={`hidden md:flex fixed safe-area-fixed-left z-30 w-64 flex-col border-r border-sidebar-border bg-sidebar shadow-xl ${
          isOpen ? "pointer-events-auto" : "pointer-events-none"
        } ${SIDEBAR_DESKTOP_TRANSITION_CLASS_NAME}`}
        style={{
          transform: isOpen
            ? "translateX(0px)"
            : `translateX(${String(SIDEBAR_CLOSED_TRANSLATE_X_PIXELS)}px)`,
          opacity: isOpen ? 1 : SIDEBAR_CLOSED_OPACITY,
        }}
      >
        <ThreadSidebarPanel
          viewport={viewport}
          threadListPaneProperties={threadListPaneProperties}
          threadSidebarRuntimeSummary={threadSidebarRuntimeSummary}
          onHideDesktopSidebar={onHideDesktopSidebar}
          onCloseMobileSidebar={onCloseMobileSidebar}
          allSystemsReady={allSystemsReady}
          hasAnySystemFailure={hasAnySystemFailure}
          commitLabel={commitLabel}
          agentDescriptors={agentDescriptors}
          codexConfigured={codexConfigured}
          healthState={healthState}
        />
      </aside>
    );
  }

  return (
    <aside
      data-testid="sidebar-mobile"
      aria-hidden={!isOpen}
      className={`md:hidden fixed safe-area-fixed-left z-50 w-64 flex flex-col border-r border-sidebar-border bg-sidebar shadow-xl ${
        isOpen ? "pointer-events-auto" : "pointer-events-none"
      } ${SIDEBAR_MOBILE_TRANSITION_CLASS_NAME}`}
      style={{
        transform: isOpen
          ? "translateX(0px)"
          : `translateX(${String(SIDEBAR_CLOSED_TRANSLATE_X_PIXELS)}px)`,
      }}
    >
      <ThreadSidebarPanel
        viewport={viewport}
        threadListPaneProperties={threadListPaneProperties}
        threadSidebarRuntimeSummary={threadSidebarRuntimeSummary}
        onHideDesktopSidebar={onHideDesktopSidebar}
        onCloseMobileSidebar={onCloseMobileSidebar}
        allSystemsReady={allSystemsReady}
        hasAnySystemFailure={hasAnySystemFailure}
        commitLabel={commitLabel}
        agentDescriptors={agentDescriptors}
        codexConfigured={codexConfigured}
        healthState={healthState}
      />
    </aside>
  );
});

ThreadSidebarViewport.displayName = "ThreadSidebarViewport";

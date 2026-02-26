import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ThreadSidebarPanel,
  type ThreadSidebarPanelProps
} from "./ThreadSidebarPanel";

interface ThreadSidebarViewportProps extends Omit<ThreadSidebarPanelProps, "viewport"> {
  viewport: "desktop" | "mobile";
  isOpen: boolean;
}

// The closed translation distance intentionally exceeds `w-64` (256px) so the border/shadow
// are fully outside the viewport during hidden states.
const SIDEBAR_CLOSED_TRANSLATE_X_PIXELS = -280;
const SIDEBAR_CLOSED_OPACITY = 0.94;
const SIDEBAR_SPRING_TRANSITION = {
  type: "spring",
  stiffness: 380,
  damping: 36,
  mass: 0.7
} as const;

export function ThreadSidebarViewport({
  viewport,
  isOpen,
  threadListPaneProperties,
  onHideDesktopSidebar,
  onCloseMobileSidebar,
  allSystemsReady,
  hasAnySystemFailure,
  commitLabel,
  agentDescriptors,
  codexConfigured,
  healthState
}: ThreadSidebarViewportProps): React.JSX.Element {
  // Keep the sidebar mounted after first open so thread-list scroll position and
  // panel-local state survive open/close transitions.
  const [hasOpened, setHasOpened] = useState<boolean>(isOpen);

  useEffect(() => {
    if (isOpen) {
      setHasOpened(true);
    }
  }, [isOpen]);

  if (!hasOpened) {
    return <></>;
  }

  if (viewport === "desktop") {
    return (
      <motion.aside
        initial={false}
        animate={{
          x: isOpen ? 0 : SIDEBAR_CLOSED_TRANSLATE_X_PIXELS,
          opacity: isOpen ? 1 : SIDEBAR_CLOSED_OPACITY
        }}
        transition={SIDEBAR_SPRING_TRANSITION}
        data-testid="sidebar-desktop"
        aria-hidden={!isOpen}
        className={`hidden md:flex fixed safe-area-fixed-left z-30 w-64 flex-col border-r border-sidebar-border bg-sidebar shadow-xl ${
          isOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <ThreadSidebarPanel
          viewport={viewport}
          threadListPaneProperties={threadListPaneProperties}
          onHideDesktopSidebar={onHideDesktopSidebar}
          onCloseMobileSidebar={onCloseMobileSidebar}
          allSystemsReady={allSystemsReady}
          hasAnySystemFailure={hasAnySystemFailure}
          commitLabel={commitLabel}
          agentDescriptors={agentDescriptors}
          codexConfigured={codexConfigured}
          healthState={healthState}
        />
      </motion.aside>
    );
  }

  return (
    <motion.aside
      initial={false}
      animate={{ x: isOpen ? 0 : SIDEBAR_CLOSED_TRANSLATE_X_PIXELS }}
      transition={SIDEBAR_SPRING_TRANSITION}
      data-testid="sidebar-mobile"
      aria-hidden={!isOpen}
      className={`md:hidden fixed safe-area-fixed-left z-50 w-64 flex flex-col border-r border-sidebar-border bg-sidebar shadow-xl ${
        isOpen ? "pointer-events-auto" : "pointer-events-none"
      }`}
    >
      <ThreadSidebarPanel
        viewport={viewport}
        threadListPaneProperties={threadListPaneProperties}
        onHideDesktopSidebar={onHideDesktopSidebar}
        onCloseMobileSidebar={onCloseMobileSidebar}
        allSystemsReady={allSystemsReady}
        hasAnySystemFailure={hasAnySystemFailure}
        commitLabel={commitLabel}
        agentDescriptors={agentDescriptors}
        codexConfigured={codexConfigured}
        healthState={healthState}
      />
    </motion.aside>
  );
}

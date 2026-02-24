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
        animate={{ x: isOpen ? 0 : -280, opacity: isOpen ? 1 : 0.94 }}
        transition={{ type: "spring", stiffness: 380, damping: 36, mass: 0.7 }}
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
      animate={{ x: isOpen ? 0 : -280 }}
      transition={{ type: "spring", stiffness: 380, damping: 36, mass: 0.7 }}
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

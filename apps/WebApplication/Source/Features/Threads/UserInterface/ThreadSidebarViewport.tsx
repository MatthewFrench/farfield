import { AnimatePresence, motion } from "framer-motion";
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
  if (viewport === "desktop") {
    return (
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.aside
            key="desktop-sidebar"
            initial={{ x: -280, opacity: 0.94 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -280, opacity: 0.94 }}
            transition={{ type: "spring", stiffness: 380, damping: 36, mass: 0.7 }}
            data-testid="sidebar-desktop"
            className="hidden md:flex fixed safe-area-fixed-left z-30 w-64 flex-col border-r border-sidebar-border bg-sidebar shadow-xl"
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
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.aside
          key="mobile-sidebar"
          initial={{ x: -280 }}
          animate={{ x: 0 }}
          exit={{ x: -280 }}
          transition={{ type: "spring", stiffness: 380, damping: 36, mass: 0.7 }}
          data-testid="sidebar-mobile"
          className="md:hidden fixed safe-area-fixed-left z-50 w-64 flex flex-col border-r border-sidebar-border bg-sidebar shadow-xl"
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
      )}
    </AnimatePresence>
  );
}

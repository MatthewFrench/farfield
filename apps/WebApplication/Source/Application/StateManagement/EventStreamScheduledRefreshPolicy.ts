import { type MutableRefObject } from "react";
import { type EventRefreshFlags } from "./EventRefreshScheduler";

const DOCUMENT_VISIBILITY_STATE_VISIBLE = "visible";
const DEBUG_APPLICATION_TAB = "debug";

export interface ScheduledRefreshExecutionSnapshot {
  activeTab: "chat" | "debug";
  selectedThreadId: string | null;
}

export function isScheduledRefreshDocumentVisible(): boolean {
  return document.visibilityState === DOCUMENT_VISIBILITY_STATE_VISIBLE;
}

export function readScheduledRefreshExecutionSnapshot(
  activeTabRef: MutableRefObject<"chat" | "debug">,
  selectedThreadIdRef: MutableRefObject<string | null>,
): ScheduledRefreshExecutionSnapshot {
  return {
    activeTab: activeTabRef.current,
    selectedThreadId: selectedThreadIdRef.current,
  };
}

export function shouldRefreshDebugWorkspace(
  refreshFlags: EventRefreshFlags,
  activeTab: "chat" | "debug",
): boolean {
  return (
    !refreshFlags.refreshCore && refreshFlags.refreshHistory && activeTab === DEBUG_APPLICATION_TAB
  );
}

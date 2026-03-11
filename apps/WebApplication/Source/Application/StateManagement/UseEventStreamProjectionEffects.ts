import { type Dispatch, type MutableRefObject, type SetStateAction, useEffect } from "react";
import {
  type ThreadRuntimeStatusByThreadIdentifier,
  type ThreadSidebarRuntimeSummary,
} from "@/Features/Threads/DomainModel/ThreadRuntimeStatusContracts";
import type { AgentId } from "@/Shared/Contracts/ApiContracts";
import {
  createInitialRuntimeNotificationProjectionCursorState,
  type RuntimeNotificationProjectionCursorState,
} from "./EventStreamNotificationProjectionCursor";
import { RuntimeWarningBannerPolicyOwner } from "./RuntimeWarningBannerPolicyOwner";
import { createInitialThreadSidebarRuntimeSummary } from "./ThreadSidebarRuntimeSummaryProjection";

function createEmptyThreadRuntimeStatusByThreadIdentifier(): ThreadRuntimeStatusByThreadIdentifier {
  return {};
}

export interface UseRuntimeProjectionResetEffectInput {
  selectedAgentId: AgentId;
  setThreadRuntimeStatusByThreadIdentifier: Dispatch<
    SetStateAction<ThreadRuntimeStatusByThreadIdentifier>
  >;
  setThreadSidebarRuntimeSummary: Dispatch<SetStateAction<ThreadSidebarRuntimeSummary>>;
}

export function useRuntimeProjectionResetEffect(
  input: UseRuntimeProjectionResetEffectInput,
  runtimeNotificationProjectionCursorStateRef: MutableRefObject<RuntimeNotificationProjectionCursorState>,
  runtimeWarningBannerPolicyOwnerRef: MutableRefObject<RuntimeWarningBannerPolicyOwner>,
): void {
  useEffect(() => {
    const runtimeNotificationProjectionCursorState = runtimeNotificationProjectionCursorStateRef;
    runtimeNotificationProjectionCursorState.current =
      createInitialRuntimeNotificationProjectionCursorState();
    runtimeWarningBannerPolicyOwnerRef.current.resetSelectedThread(null);
    input.setThreadRuntimeStatusByThreadIdentifier(
      createEmptyThreadRuntimeStatusByThreadIdentifier(),
    );
    input.setThreadSidebarRuntimeSummary(createInitialThreadSidebarRuntimeSummary());
  }, [
    input.selectedAgentId,
    input.setThreadRuntimeStatusByThreadIdentifier,
    input.setThreadSidebarRuntimeSummary,
  ]);
}

export interface UseRuntimeWarningThreadSwitchEffectInput {
  selectedThreadId: string | null;
  setThreadSidebarRuntimeSummary: Dispatch<SetStateAction<ThreadSidebarRuntimeSummary>>;
}

export function useRuntimeWarningThreadSwitchEffect(
  input: UseRuntimeWarningThreadSwitchEffectInput,
  runtimeWarningBannerPolicyOwnerRef: MutableRefObject<RuntimeWarningBannerPolicyOwner>,
): void {
  useEffect(() => {
    const threadSwitchRequiresWarningClear =
      runtimeWarningBannerPolicyOwnerRef.current.readThreadSwitchRequiresWarningClear(
        input.selectedThreadId,
      );
    if (!threadSwitchRequiresWarningClear) {
      return;
    }
    input.setThreadSidebarRuntimeSummary((previousSummary) => {
      if (previousSummary.warning === null) {
        return previousSummary;
      }
      return {
        ...previousSummary,
        warning: null,
      };
    });
  }, [input.selectedThreadId, input.setThreadSidebarRuntimeSummary]);
}

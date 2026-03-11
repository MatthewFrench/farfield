import type { CapabilityReadNotificationEventsOptions } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import type { AgentId } from "@/Shared/Contracts/ApiContracts";

const NOTIFICATION_EVENTS_REFRESH_LIMIT = 80;

export interface RuntimeNotificationProjectionCursorState {
  nextSequence: number | null;
}

export function createInitialRuntimeNotificationProjectionCursorState(): RuntimeNotificationProjectionCursorState {
  return { nextSequence: null };
}

export function readNotificationEventsRequestOptions(input: {
  selectedAgentId: AgentId;
  notificationProjectionCursorState: RuntimeNotificationProjectionCursorState;
}): CapabilityReadNotificationEventsOptions {
  return {
    agentId: input.selectedAgentId,
    limit: NOTIFICATION_EVENTS_REFRESH_LIMIT,
    sinceSequence: input.notificationProjectionCursorState.nextSequence,
  };
}

export function readRuntimeNotificationProjectionSinceSequence(
  nextSequence: number,
): number | null {
  return nextSequence === 0 ? null : nextSequence - 1;
}

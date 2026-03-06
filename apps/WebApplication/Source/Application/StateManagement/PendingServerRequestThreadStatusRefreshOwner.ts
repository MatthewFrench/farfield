import { type Dispatch, type SetStateAction, useEffect } from "react";
import { type CapabilityServerClient } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import { type ThreadRuntimeStatusByThreadIdentifier } from "@/Features/Threads/DomainModel/ThreadRuntimeStatusContracts";
import { type AgentId } from "@/Shared/Contracts/ApiContracts";
import { toErrorMessage } from "@/Shared/Errors/ErrorMessage";
import { isRequestCanceledError } from "@/Shared/Errors/RequestCanceledError";
import {
  applyPendingServerRequestThreadStatuses,
  projectPendingServerRequestsToThreadRuntimeStatuses,
} from "./PendingServerRequestThreadStatusProjection";
import { SERVER_REQUEST_RESOLVED_NOTIFICATION_METHOD } from "./RuntimeNotificationWarningEvents";

const PENDING_SERVER_REQUEST_SUPPORTED_AGENT_IDENTIFIER: AgentId = "codex";
const PENDING_SERVER_REQUEST_THREAD_STATUS_REFRESH_OPERATION =
  "refresh-pending-server-request-thread-statuses";

function canReadPendingServerRequestThreadStatuses(selectedAgentId: AgentId): boolean {
  return selectedAgentId === PENDING_SERVER_REQUEST_SUPPORTED_AGENT_IDENTIFIER;
}

function createPendingServerRequestThreadStatusRefreshError<ErrorType>(error: ErrorType): Error {
  const normalizedMessage = toErrorMessage(error).trim();
  return new Error(
    `${PENDING_SERVER_REQUEST_THREAD_STATUS_REFRESH_OPERATION}: ${normalizedMessage}`,
  );
}

export function shouldRefreshPendingServerRequestThreadStatuses(input: {
  resetRequired: boolean;
  warningEvents: readonly { method: string }[];
}): boolean {
  if (input.resetRequired) {
    return true;
  }

  return input.warningEvents.some(
    (warningEvent) => warningEvent.method === SERVER_REQUEST_RESOLVED_NOTIFICATION_METHOD,
  );
}

/**
 * Owns the capability read that backfills approval/user-input waiting thread statuses
 * from pending server requests when live notification history is incomplete.
 */
export async function refreshPendingServerRequestThreadStatuses(input: {
  selectedAgentId: AgentId;
  capabilityServerClient: CapabilityServerClient;
  setThreadRuntimeStatusByThreadIdentifier: Dispatch<
    SetStateAction<ThreadRuntimeStatusByThreadIdentifier>
  >;
  shouldCancel?: () => boolean;
}): Promise<void> {
  if (!canReadPendingServerRequestThreadStatuses(input.selectedAgentId)) {
    return;
  }

  const pendingServerRequestsResponse =
    await input.capabilityServerClient.readPendingServerRequests({
      agentId: input.selectedAgentId,
    });
  if (input.shouldCancel?.() === true) {
    return;
  }

  const nextPendingStatusByThreadIdentifier = projectPendingServerRequestsToThreadRuntimeStatuses(
    pendingServerRequestsResponse,
  );
  input.setThreadRuntimeStatusByThreadIdentifier((previousStatusByThreadIdentifier) =>
    applyPendingServerRequestThreadStatuses({
      previousStatusByThreadIdentifier,
      nextPendingStatusByThreadIdentifier,
    }),
  );
}

export interface UsePendingServerRequestThreadStatusHydrationEffectInput {
  ensureApiSessionBootstrapped: () => Promise<boolean>;
  selectedAgentId: AgentId;
  capabilityServerClient: CapabilityServerClient;
  setThreadRuntimeStatusByThreadIdentifier: Dispatch<
    SetStateAction<ThreadRuntimeStatusByThreadIdentifier>
  >;
  handleRuntimeRequestError: <ErrorType>(error: ErrorType) => void;
}

export function usePendingServerRequestThreadStatusHydrationEffect(
  input: UsePendingServerRequestThreadStatusHydrationEffectInput,
): void {
  useEffect(() => {
    let shouldCancelRefresh = false;

    const hydratePendingServerRequestThreadStatuses = async (): Promise<void> => {
      try {
        const hasApiSession = await input.ensureApiSessionBootstrapped();
        if (!hasApiSession || shouldCancelRefresh) {
          return;
        }

        await refreshPendingServerRequestThreadStatuses({
          selectedAgentId: input.selectedAgentId,
          capabilityServerClient: input.capabilityServerClient,
          setThreadRuntimeStatusByThreadIdentifier: input.setThreadRuntimeStatusByThreadIdentifier,
          shouldCancel: () => shouldCancelRefresh,
        });
      } catch (error) {
        if (shouldCancelRefresh) {
          return;
        }
        if (error instanceof Error && isRequestCanceledError(error)) {
          return;
        }
        input.handleRuntimeRequestError(createPendingServerRequestThreadStatusRefreshError(error));
      }
    };

    void hydratePendingServerRequestThreadStatuses();
    return () => {
      shouldCancelRefresh = true;
    };
  }, [
    input.ensureApiSessionBootstrapped,
    input.selectedAgentId,
    input.capabilityServerClient,
    input.setThreadRuntimeStatusByThreadIdentifier,
    input.handleRuntimeRequestError,
  ]);
}

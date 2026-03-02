import { type Dispatch, type SetStateAction, useEffect } from "react";
import { type CapabilityServerClient } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import { type ThreadSidebarRuntimeSummary } from "@/Features/Threads/DomainModel/ThreadRuntimeStatusContracts";
import { type AgentId } from "@/Shared/Contracts/ApiContracts";
import { toErrorMessage } from "@/Shared/Errors/ErrorMessage";
import { isRequestCanceledError } from "@/Shared/Errors/RequestCanceledError";
import {
  readThreadSidebarAccountSummary,
  readThreadSidebarAppsSummary,
  readThreadSidebarRateLimitSummary,
} from "./ThreadSidebarRuntimeSummaryProjection";

const SIDEBAR_APPS_LIST_LIMIT = 100;
const SIDEBAR_RUNTIME_SUMMARY_REFRESH_OPERATION = "refresh-sidebar-runtime-summary";
const EMPTY_RUNTIME_SUMMARY_REFRESH_ERROR_MESSAGE = "Unknown sidebar runtime summary refresh error";

interface RefreshThreadSidebarRuntimeSummaryInput {
  selectedAgentId: AgentId;
  canReadAccount: boolean;
  canReadAccountRateLimits: boolean;
  canListApps: boolean;
  capabilityServerClient: CapabilityServerClient;
  setThreadSidebarRuntimeSummary: Dispatch<SetStateAction<ThreadSidebarRuntimeSummary>>;
  shouldCancel: () => boolean;
}

async function refreshThreadSidebarRuntimeSummary(
  input: RefreshThreadSidebarRuntimeSummaryInput,
): Promise<void> {
  const refreshOperations: Promise<void>[] = [];

  if (input.canReadAccount) {
    const refreshAccountSummary = async (): Promise<void> => {
      const accountResponse = await input.capabilityServerClient.readAccount({
        agentId: input.selectedAgentId,
      });
      if (input.shouldCancel()) {
        return;
      }
      input.setThreadSidebarRuntimeSummary((previousSummary) => ({
        ...previousSummary,
        account: readThreadSidebarAccountSummary(accountResponse),
      }));
    };
    refreshOperations.push(refreshAccountSummary());
  }

  if (input.canReadAccountRateLimits) {
    const refreshRateLimitsSummary = async (): Promise<void> => {
      const rateLimitsResponse = await input.capabilityServerClient.readAccountRateLimits({
        agentId: input.selectedAgentId,
      });
      if (input.shouldCancel()) {
        return;
      }
      input.setThreadSidebarRuntimeSummary((previousSummary) => ({
        ...previousSummary,
        rateLimits: readThreadSidebarRateLimitSummary(rateLimitsResponse),
      }));
    };
    refreshOperations.push(refreshRateLimitsSummary());
  }

  if (input.canListApps) {
    const refreshAppsSummary = async (): Promise<void> => {
      const appsResponse = await input.capabilityServerClient.listApps({
        limit: SIDEBAR_APPS_LIST_LIMIT,
      });
      if (input.shouldCancel()) {
        return;
      }
      input.setThreadSidebarRuntimeSummary((previousSummary) => ({
        ...previousSummary,
        apps: readThreadSidebarAppsSummary(appsResponse),
      }));
    };
    refreshOperations.push(refreshAppsSummary());
  }

  if (refreshOperations.length === 0) {
    return;
  }

  await Promise.all(refreshOperations);
}

export interface UseThreadSidebarRuntimeHydrationEffectInput {
  selectedAgentId: AgentId;
  canReadAccount: boolean;
  canReadAccountRateLimits: boolean;
  canListApps: boolean;
  capabilityServerClient: CapabilityServerClient;
  setThreadSidebarRuntimeSummary: Dispatch<SetStateAction<ThreadSidebarRuntimeSummary>>;
  handleRuntimeRequestError: <ErrorType>(error: ErrorType) => void;
}

function createSidebarRuntimeSummaryRefreshError<ErrorType>(error: ErrorType): Error {
  const normalizedMessage = toErrorMessage(error).trim();
  const readableMessage =
    normalizedMessage.length > 0 ? normalizedMessage : EMPTY_RUNTIME_SUMMARY_REFRESH_ERROR_MESSAGE;
  return new Error(`${SIDEBAR_RUNTIME_SUMMARY_REFRESH_OPERATION}: ${readableMessage}`);
}

export function useThreadSidebarRuntimeHydrationEffect(
  input: UseThreadSidebarRuntimeHydrationEffectInput,
): void {
  useEffect(() => {
    let shouldCancelRefresh = false;

    const hydrateThreadSidebarRuntimeSummary = async (): Promise<void> => {
      try {
        await refreshThreadSidebarRuntimeSummary({
          selectedAgentId: input.selectedAgentId,
          canReadAccount: input.canReadAccount,
          canReadAccountRateLimits: input.canReadAccountRateLimits,
          canListApps: input.canListApps,
          capabilityServerClient: input.capabilityServerClient,
          setThreadSidebarRuntimeSummary: input.setThreadSidebarRuntimeSummary,
          shouldCancel: () => shouldCancelRefresh,
        });
      } catch (error) {
        if (shouldCancelRefresh) {
          return;
        }
        if (error instanceof Error && isRequestCanceledError(error)) {
          return;
        }
        input.handleRuntimeRequestError(createSidebarRuntimeSummaryRefreshError(error));
      }
    };

    void hydrateThreadSidebarRuntimeSummary();
    return () => {
      shouldCancelRefresh = true;
    };
  }, [
    input.selectedAgentId,
    input.canReadAccount,
    input.canReadAccountRateLimits,
    input.canListApps,
    input.capabilityServerClient,
    input.setThreadSidebarRuntimeSummary,
    input.handleRuntimeRequestError,
  ]);
}

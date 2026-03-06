import { type Dispatch, type SetStateAction, useEffect } from "react";
import { type CapabilityServerClient } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import { type ThreadSidebarRuntimeSummary } from "@/Features/Threads/DomainModel/ThreadRuntimeStatusContracts";
import { type AgentId } from "@/Shared/Contracts/ApiContracts";
import { toErrorMessage } from "@/Shared/Errors/ErrorMessage";
import { isRequestCanceledError } from "@/Shared/Errors/RequestCanceledError";
import {
  ThreadSidebarRuntimeSummaryNetworkCacheOwner,
  type ThreadSidebarRuntimeSummaryNetworkSnapshotCoverage,
} from "./ThreadSidebarRuntimeSummaryNetworkCacheOwner";
import {
  readThreadSidebarAccountSummary,
  readThreadSidebarAppsSummary,
  readThreadSidebarRateLimitSummary,
} from "./ThreadSidebarRuntimeSummaryProjection";

const SIDEBAR_APPS_LIST_LIMIT = 100;
const SIDEBAR_RUNTIME_SUMMARY_REFRESH_OPERATION = "refresh-sidebar-runtime-summary";
const EMPTY_RUNTIME_SUMMARY_REFRESH_ERROR_MESSAGE = "Unknown sidebar runtime summary refresh error";
const threadSidebarRuntimeSummaryNetworkCacheOwner =
  new ThreadSidebarRuntimeSummaryNetworkCacheOwner();

interface ThreadSidebarRuntimeSummaryNetworkSnapshot {
  account: ThreadSidebarRuntimeSummary["account"];
  rateLimits: ThreadSidebarRuntimeSummary["rateLimits"];
  apps: ThreadSidebarRuntimeSummary["apps"];
}

interface ReadThreadSidebarRuntimeSummaryNetworkSnapshotInput {
  selectedAgentId: AgentId;
  canReadAccount: boolean;
  canReadAccountRateLimits: boolean;
  canListApps: boolean;
  capabilityServerClient: CapabilityServerClient;
  shouldCancel: () => boolean;
}

function applyNetworkSnapshotToSidebarRuntimeSummary(
  setThreadSidebarRuntimeSummary: Dispatch<SetStateAction<ThreadSidebarRuntimeSummary>>,
  snapshot: ThreadSidebarRuntimeSummaryNetworkSnapshot,
): void {
  setThreadSidebarRuntimeSummary((previousSummary) => ({
    ...previousSummary,
    account: snapshot.account,
    rateLimits: snapshot.rateLimits,
    apps: snapshot.apps,
  }));
}

function readRequiredSnapshotCoverage(input: {
  canReadAccount: boolean;
  canReadAccountRateLimits: boolean;
  canListApps: boolean;
}): ThreadSidebarRuntimeSummaryNetworkSnapshotCoverage {
  return {
    account: input.canReadAccount,
    rateLimits: input.canReadAccountRateLimits,
    apps: input.canListApps,
  };
}

async function readThreadSidebarRuntimeSummaryNetworkSnapshot(
  input: ReadThreadSidebarRuntimeSummaryNetworkSnapshotInput,
): Promise<ThreadSidebarRuntimeSummaryNetworkSnapshot> {
  const nextSnapshot: ThreadSidebarRuntimeSummaryNetworkSnapshot = {
    account: null,
    rateLimits: null,
    apps: null,
  };
  const refreshOperations: Promise<void>[] = [];

  if (input.canReadAccount) {
    const refreshAccountSummary = async (): Promise<void> => {
      const accountResponse = await input.capabilityServerClient.readAccount({
        agentId: input.selectedAgentId,
      });
      if (input.shouldCancel()) {
        return;
      }
      nextSnapshot.account = readThreadSidebarAccountSummary(accountResponse);
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
      nextSnapshot.rateLimits = readThreadSidebarRateLimitSummary(rateLimitsResponse);
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
      nextSnapshot.apps = readThreadSidebarAppsSummary(appsResponse);
    };
    refreshOperations.push(refreshAppsSummary());
  }

  if (refreshOperations.length === 0) {
    return nextSnapshot;
  }

  await Promise.all(refreshOperations);
  return nextSnapshot;
}

export interface UseThreadSidebarRuntimeHydrationEffectInput {
  isSidebarVisible: boolean;
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
    if (!input.isSidebarVisible) {
      return;
    }

    let shouldCancelRefresh = false;
    const requiredCoverage = readRequiredSnapshotCoverage({
      canReadAccount: input.canReadAccount,
      canReadAccountRateLimits: input.canReadAccountRateLimits,
      canListApps: input.canListApps,
    });
    const cachedSnapshot = threadSidebarRuntimeSummaryNetworkCacheOwner.readSnapshot(
      input.selectedAgentId,
    );
    if (cachedSnapshot !== null) {
      applyNetworkSnapshotToSidebarRuntimeSummary(
        input.setThreadSidebarRuntimeSummary,
        cachedSnapshot,
      );
    }
    const freshCachedSnapshot = threadSidebarRuntimeSummaryNetworkCacheOwner.readSnapshotIfFresh(
      input.selectedAgentId,
      requiredCoverage,
    );
    if (freshCachedSnapshot !== null) {
      return;
    }

    const hydrateThreadSidebarRuntimeSummary = async (): Promise<void> => {
      try {
        const nextSnapshot = await threadSidebarRuntimeSummaryNetworkCacheOwner.readFreshOrLoad({
          agentIdentifier: input.selectedAgentId,
          requiredCoverage,
          loadSnapshot: async () =>
            await readThreadSidebarRuntimeSummaryNetworkSnapshot({
              selectedAgentId: input.selectedAgentId,
              canReadAccount: input.canReadAccount,
              canReadAccountRateLimits: input.canReadAccountRateLimits,
              canListApps: input.canListApps,
              capabilityServerClient: input.capabilityServerClient,
              shouldCancel: () => shouldCancelRefresh,
            }),
        });
        if (shouldCancelRefresh) {
          return;
        }
        applyNetworkSnapshotToSidebarRuntimeSummary(
          input.setThreadSidebarRuntimeSummary,
          nextSnapshot,
        );
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
    input.isSidebarVisible,
    input.selectedAgentId,
    input.canReadAccount,
    input.canReadAccountRateLimits,
    input.canListApps,
    input.capabilityServerClient,
    input.setThreadSidebarRuntimeSummary,
    input.handleRuntimeRequestError,
  ]);
}

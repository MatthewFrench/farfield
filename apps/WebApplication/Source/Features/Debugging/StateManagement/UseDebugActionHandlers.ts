import {
  useCallback,
  type Dispatch,
  type SetStateAction
} from "react";
import type { ErrorBannerDetails } from "@/SharedUtilities/DebugHelpers";
import type {
  DebugIssueSeverityFilter
} from "../DomainModel/DebugIssueStateResolver";
import { DebugWorkspaceActionCoordinator } from "./DebugWorkspaceActionCoordinator";
import { type DebugServerClient } from "../DataAccess/DebugServerClient";
import { type ReplayHistoryEntryRequestInput } from "../UserInterface/DebugHistoryDetailPanel";
import { type DebugWorkspaceSection } from "../UserInterface/DebugWorkspacePane";
import { type DebugHistoryDetailResponse } from "../DataAccess/DebugServerClient";

export interface UseDebugActionHandlersInput {
  debugWorkspaceActionCoordinator: DebugWorkspaceActionCoordinator;
  debugServerClient: DebugServerClient;
  refreshAll: () => Promise<void>;
  traceLabel: string;
  traceNote: string;
  errorBannerDetails: ErrorBannerDetails;
  setActiveTab: Dispatch<SetStateAction<"chat" | "debug">>;
  setDebugWorkspaceSection: Dispatch<SetStateAction<DebugWorkspaceSection>>;
  setDebugIssueSeverityFilter: Dispatch<SetStateAction<DebugIssueSeverityFilter>>;
  setSelectedDebugIssueId: Dispatch<SetStateAction<string>>;
  setDebugIssueFilterQuery: Dispatch<SetStateAction<string>>;
  onHistoryDetailLoaded: (historyDetail: DebugHistoryDetailResponse | null) => void;
}

export interface DebugActionHandlers {
  loadHistoryDetail: (id: string) => Promise<void>;
  replayHistoryEntryFromDetail: (input: ReplayHistoryEntryRequestInput) => void;
  startTraceFromDebugPanel: () => void;
  markTraceFromDebugPanel: () => void;
  stopTraceFromDebugPanel: () => void;
  openDebugFromErrorBanner: () => void;
}

export function useDebugActionHandlers(input: UseDebugActionHandlersInput): DebugActionHandlers {
  const loadHistoryDetail = useCallback(async (id: string) => {
    await input.debugWorkspaceActionCoordinator.loadHistoryDetail({
      historyEntryId: id,
      debugClient: input.debugServerClient,
      onHistoryDetailLoaded: input.onHistoryDetailLoaded
    });
  }, [input.debugServerClient, input.debugWorkspaceActionCoordinator, input.onHistoryDetailLoaded]);

  const replayHistoryEntryFromDetail = useCallback(
    (replayInput: ReplayHistoryEntryRequestInput) => {
      void input.debugWorkspaceActionCoordinator.replayHistoryEntry({
        replayRequest: replayInput,
        debugClient: input.debugServerClient,
        refreshAll: input.refreshAll
      });
    },
    [input.debugServerClient, input.debugWorkspaceActionCoordinator, input.refreshAll]
  );

  const startTraceFromDebugPanel = useCallback(() => {
    void input.debugWorkspaceActionCoordinator.startTrace({
      traceLabel: input.traceLabel,
      debugClient: input.debugServerClient,
      refreshAll: input.refreshAll
    });
  }, [input.debugServerClient, input.debugWorkspaceActionCoordinator, input.refreshAll, input.traceLabel]);

  const markTraceFromDebugPanel = useCallback(() => {
    void input.debugWorkspaceActionCoordinator.markTrace({
      traceNote: input.traceNote,
      debugClient: input.debugServerClient,
      refreshAll: input.refreshAll
    });
  }, [input.debugServerClient, input.debugWorkspaceActionCoordinator, input.refreshAll, input.traceNote]);

  const stopTraceFromDebugPanel = useCallback(() => {
    void input.debugWorkspaceActionCoordinator.stopTrace({
      debugClient: input.debugServerClient,
      refreshAll: input.refreshAll
    });
  }, [input.debugServerClient, input.debugWorkspaceActionCoordinator, input.refreshAll]);

  const openDebugFromErrorBanner = useCallback(() => {
    input.setActiveTab("debug");
    input.setDebugWorkspaceSection("issues");
    input.setDebugIssueSeverityFilter("all");

    if (input.errorBannerDetails.errorId) {
      input.setSelectedDebugIssueId(`error:${input.errorBannerDetails.errorId}`);
      input.setDebugIssueFilterQuery(input.errorBannerDetails.errorId);
      return;
    }

    const nextFilterQuery = input.errorBannerDetails.requestId
      ?? input.errorBannerDetails.actionId
      ?? input.errorBannerDetails.operation
      ?? "";
    input.setDebugIssueFilterQuery(nextFilterQuery);
  }, [
    input.errorBannerDetails.actionId,
    input.errorBannerDetails.errorId,
    input.errorBannerDetails.operation,
    input.errorBannerDetails.requestId,
    input.setActiveTab,
    input.setDebugIssueFilterQuery,
    input.setDebugIssueSeverityFilter,
    input.setDebugWorkspaceSection,
    input.setSelectedDebugIssueId
  ]);

  return {
    loadHistoryDetail,
    replayHistoryEntryFromDetail,
    startTraceFromDebugPanel,
    markTraceFromDebugPanel,
    stopTraceFromDebugPanel,
    openDebugFromErrorBanner
  };
}

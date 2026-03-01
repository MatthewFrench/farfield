import { type Dispatch, type SetStateAction } from "react";
import type { CapabilityServerClient } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import type {
  DebugAppServerCoverageAuthCompletionEventsResult,
  DebugAppServerCoverageFuzzySessionNotificationsResult,
  DebugAppServerCoverageModelReroutedEventsResult,
  DebugAppServerCoverageNotificationEventsResult,
  DebugAppServerCoveragePendingServerRequestsResult,
  DebugAppServerCoverageServerRequestResolvedEventsResult,
} from "../DomainModel/DebugAppServerCoverageContracts";
import {
  createReadAuthCompletionEventsAction,
  createReadFuzzySessionNotificationsAction,
  createReadModelReroutedEventsAction,
  createReadNotificationEventsAction,
  createReadPendingServerRequestsAction,
  createReadServerRequestResolvedEventsAction,
} from "./DebugAppServerCoverageMutationActionHelpers";

interface NotificationCoverageReadActions {
  readNotificationEvents: (sinceSequence?: number | null) => void;
  readAuthCompletionEvents: (sinceSequence?: number | null) => void;
  readServerRequestResolvedEvents: (sinceSequence?: number | null) => void;
  readFuzzySessionNotifications: (sinceSequence?: number | null) => void;
  readModelReroutedEvents: (sinceSequence?: number | null) => void;
  readPendingServerRequests: () => void;
}

interface CreateNotificationCoverageReadActionsInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastNotificationEventsResult: Dispatch<
    SetStateAction<DebugAppServerCoverageNotificationEventsResult | null>
  >;
  setLastAuthCompletionEventsResult: Dispatch<
    SetStateAction<DebugAppServerCoverageAuthCompletionEventsResult | null>
  >;
  setLastServerRequestResolvedEventsResult: Dispatch<
    SetStateAction<DebugAppServerCoverageServerRequestResolvedEventsResult | null>
  >;
  setLastFuzzySessionNotificationsResult: Dispatch<
    SetStateAction<DebugAppServerCoverageFuzzySessionNotificationsResult | null>
  >;
  setLastModelReroutedEventsResult: Dispatch<
    SetStateAction<DebugAppServerCoverageModelReroutedEventsResult | null>
  >;
  setLastPendingServerRequestsResult: Dispatch<
    SetStateAction<DebugAppServerCoveragePendingServerRequestsResult | null>
  >;
}

/**
 * Builds cursor-read debug actions for notification-driven coverage methods.
 * Keeps read action wiring out of the mutation diagnostics owner to preserve owner size budgets.
 */
export function createNotificationCoverageReadActions(
  input: CreateNotificationCoverageReadActionsInput,
): NotificationCoverageReadActions {
  const sharedActionInput = {
    capabilityServerClient: input.capabilityServerClient,
    isRunningCoverageAction: input.isRunningCoverageAction,
    setIsRunningCoverageAction: input.setIsRunningCoverageAction,
    setCoverageActionErrorMessage: input.setCoverageActionErrorMessage,
  };

  return {
    readNotificationEvents: createReadNotificationEventsAction({
      ...sharedActionInput,
      setLastNotificationEventsResult: input.setLastNotificationEventsResult,
    }),
    readAuthCompletionEvents: createReadAuthCompletionEventsAction({
      ...sharedActionInput,
      setLastAuthCompletionEventsResult: input.setLastAuthCompletionEventsResult,
    }),
    readServerRequestResolvedEvents: createReadServerRequestResolvedEventsAction({
      ...sharedActionInput,
      setLastServerRequestResolvedEventsResult: input.setLastServerRequestResolvedEventsResult,
    }),
    readFuzzySessionNotifications: createReadFuzzySessionNotificationsAction({
      ...sharedActionInput,
      setLastFuzzySessionNotificationsResult: input.setLastFuzzySessionNotificationsResult,
    }),
    readModelReroutedEvents: createReadModelReroutedEventsAction({
      ...sharedActionInput,
      setLastModelReroutedEventsResult: input.setLastModelReroutedEventsResult,
    }),
    readPendingServerRequests: createReadPendingServerRequestsAction({
      ...sharedActionInput,
      setLastPendingServerRequestsResult: input.setLastPendingServerRequestsResult,
    }),
  };
}

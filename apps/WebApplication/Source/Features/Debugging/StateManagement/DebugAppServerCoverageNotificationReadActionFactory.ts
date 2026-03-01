import { type Dispatch, type SetStateAction } from "react";
import type { CapabilityServerClient } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import type {
  DebugAppServerCoverageAuthCompletionEventsResult,
  DebugAppServerCoverageErrorNotificationsResult,
  DebugAppServerCoverageFuzzySessionNotificationsResult,
  DebugAppServerCoverageItemDeltaNotificationsResult,
  DebugAppServerCoverageModelReroutedEventsResult,
  DebugAppServerCoverageNotificationEventsResult,
  DebugAppServerCoveragePendingServerRequestsResult,
  DebugAppServerCoverageServerRequestResolvedEventsResult,
  DebugAppServerCoverageThreadLifecycleNotificationsResult,
  DebugAppServerCoverageTurnLifecycleNotificationsResult,
  DebugAppServerCoverageWarningNotificationsResult,
} from "../DomainModel/DebugAppServerCoverageContracts";
import { createReadErrorNotificationsAction } from "./DebugAppServerCoverageErrorNotificationReadAction";
import { createReadItemDeltaNotificationsAction } from "./DebugAppServerCoverageItemDeltaNotificationReadAction";
import {
  createReadAuthCompletionEventsAction,
  createReadFuzzySessionNotificationsAction,
  createReadModelReroutedEventsAction,
  createReadNotificationEventsAction,
  createReadPendingServerRequestsAction,
  createReadServerRequestResolvedEventsAction,
  createReadWarningNotificationsAction,
} from "./DebugAppServerCoverageMutationActionHelpers";
import { createReadThreadLifecycleNotificationsAction } from "./DebugAppServerCoverageThreadLifecycleNotificationReadAction";
import { createReadTurnLifecycleNotificationsAction } from "./DebugAppServerCoverageTurnLifecycleNotificationReadAction";

interface NotificationCoverageReadActions {
  readNotificationEvents: (sinceSequence?: number | null) => void;
  readAuthCompletionEvents: (sinceSequence?: number | null) => void;
  readServerRequestResolvedEvents: (sinceSequence?: number | null) => void;
  readFuzzySessionNotifications: (sinceSequence?: number | null) => void;
  readModelReroutedEvents: (sinceSequence?: number | null) => void;
  readWarningNotifications: (sinceSequence?: number | null) => void;
  readThreadLifecycleNotifications: (sinceSequence?: number | null) => void;
  readTurnLifecycleNotifications: (sinceSequence?: number | null) => void;
  readItemDeltaNotifications: (sinceSequence?: number | null) => void;
  readErrorNotifications: (sinceSequence?: number | null) => void;
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
  setLastWarningNotificationsResult: Dispatch<
    SetStateAction<DebugAppServerCoverageWarningNotificationsResult | null>
  >;
  setLastThreadLifecycleNotificationsResult: Dispatch<
    SetStateAction<DebugAppServerCoverageThreadLifecycleNotificationsResult | null>
  >;
  setLastTurnLifecycleNotificationsResult: Dispatch<
    SetStateAction<DebugAppServerCoverageTurnLifecycleNotificationsResult | null>
  >;
  setLastItemDeltaNotificationsResult: Dispatch<
    SetStateAction<DebugAppServerCoverageItemDeltaNotificationsResult | null>
  >;
  setLastErrorNotificationsResult: Dispatch<
    SetStateAction<DebugAppServerCoverageErrorNotificationsResult | null>
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
    readWarningNotifications: createReadWarningNotificationsAction({
      ...sharedActionInput,
      setLastWarningNotificationsResult: input.setLastWarningNotificationsResult,
    }),
    readThreadLifecycleNotifications: createReadThreadLifecycleNotificationsAction({
      ...sharedActionInput,
      setLastThreadLifecycleNotificationsResult: input.setLastThreadLifecycleNotificationsResult,
    }),
    readTurnLifecycleNotifications: createReadTurnLifecycleNotificationsAction({
      ...sharedActionInput,
      setLastTurnLifecycleNotificationsResult: input.setLastTurnLifecycleNotificationsResult,
    }),
    readItemDeltaNotifications: createReadItemDeltaNotificationsAction({
      ...sharedActionInput,
      setLastItemDeltaNotificationsResult: input.setLastItemDeltaNotificationsResult,
    }),
    readErrorNotifications: createReadErrorNotificationsAction({
      ...sharedActionInput,
      setLastErrorNotificationsResult: input.setLastErrorNotificationsResult,
    }),
    readPendingServerRequests: createReadPendingServerRequestsAction({
      ...sharedActionInput,
      setLastPendingServerRequestsResult: input.setLastPendingServerRequestsResult,
    }),
  };
}

import { type Dispatch, type SetStateAction } from "react";
import type { CapabilityServerClient } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import type { DebugAppServerCoverageItemDeltaNotificationsResult } from "../DomainModel/DebugAppServerCoverageContracts";
import { mapItemDeltaNotificationsResult } from "./DebugAppServerCoverageItemDeltaNotificationMappers";
import { runCoverageAsyncMutation } from "./DebugAppServerCoverageMutationActionHelpers";

const COVERAGE_MUTATION_OPERATION_NAME = "debug-coverage-action";
const COVERAGE_ITEM_DELTA_NOTIFICATIONS_LIMIT = 360;

interface RunItemDeltaNotificationsReadMutationInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastItemDeltaNotificationsResult: Dispatch<
    SetStateAction<DebugAppServerCoverageItemDeltaNotificationsResult | null>
  >;
  sinceSequence?: number | null;
}

interface CreateReadItemDeltaNotificationsActionInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastItemDeltaNotificationsResult: Dispatch<
    SetStateAction<DebugAppServerCoverageItemDeltaNotificationsResult | null>
  >;
}

function runItemDeltaNotificationsReadMutation(
  input: RunItemDeltaNotificationsReadMutationInput,
): void {
  const normalizedSinceSequence =
    input.sinceSequence === undefined || input.sinceSequence === null ? null : input.sinceSequence;
  if (
    normalizedSinceSequence !== null &&
    (!Number.isInteger(normalizedSinceSequence) || normalizedSinceSequence < 0)
  ) {
    return;
  }

  runCoverageAsyncMutation({
    isRunningCoverageAction: input.isRunningCoverageAction,
    setIsRunningCoverageAction: input.setIsRunningCoverageAction,
    setCoverageActionErrorMessage: input.setCoverageActionErrorMessage,
    run: async () => {
      const response = await input.capabilityServerClient.readNotificationEvents({
        actionName: COVERAGE_MUTATION_OPERATION_NAME,
        limit: COVERAGE_ITEM_DELTA_NOTIFICATIONS_LIMIT,
        ...(normalizedSinceSequence !== null ? { sinceSequence: normalizedSinceSequence } : {}),
      });
      input.setLastItemDeltaNotificationsResult(
        mapItemDeltaNotificationsResult(response, normalizedSinceSequence),
      );
    },
  });
}

export function createReadItemDeltaNotificationsAction(
  input: CreateReadItemDeltaNotificationsActionInput,
) {
  return (sinceSequence?: number | null): void => {
    runItemDeltaNotificationsReadMutation({
      capabilityServerClient: input.capabilityServerClient,
      isRunningCoverageAction: input.isRunningCoverageAction,
      setIsRunningCoverageAction: input.setIsRunningCoverageAction,
      setCoverageActionErrorMessage: input.setCoverageActionErrorMessage,
      setLastItemDeltaNotificationsResult: input.setLastItemDeltaNotificationsResult,
      ...(sinceSequence !== undefined ? { sinceSequence } : {}),
    });
  };
}

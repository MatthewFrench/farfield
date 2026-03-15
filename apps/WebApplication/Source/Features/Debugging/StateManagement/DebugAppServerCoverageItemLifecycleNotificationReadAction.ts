import { type Dispatch, type SetStateAction } from "react";
import type { CapabilityServerClient } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import type { DebugAppServerCoverageItemLifecycleNotificationsResult } from "../DomainModel/DebugAppServerCoverageContracts";
import { mapItemLifecycleNotificationsResult } from "./DebugAppServerCoverageItemLifecycleNotificationMappers";
import { runCoverageAsyncMutation } from "./DebugAppServerCoverageMutationActionHelpers";

const COVERAGE_MUTATION_OPERATION_NAME = "debug-coverage-action";
const COVERAGE_ITEM_LIFECYCLE_NOTIFICATIONS_LIMIT = 380;

interface RunItemLifecycleNotificationsReadMutationInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastItemLifecycleNotificationsResult: Dispatch<
    SetStateAction<DebugAppServerCoverageItemLifecycleNotificationsResult | null>
  >;
  sinceSequence?: number | null;
}

interface CreateReadItemLifecycleNotificationsActionInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastItemLifecycleNotificationsResult: Dispatch<
    SetStateAction<DebugAppServerCoverageItemLifecycleNotificationsResult | null>
  >;
}

function runItemLifecycleNotificationsReadMutation(
  input: RunItemLifecycleNotificationsReadMutationInput,
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
        limit: COVERAGE_ITEM_LIFECYCLE_NOTIFICATIONS_LIMIT,
        ...(normalizedSinceSequence !== null ? { sinceSequence: normalizedSinceSequence } : {}),
      });
      input.setLastItemLifecycleNotificationsResult(
        mapItemLifecycleNotificationsResult(response, normalizedSinceSequence),
      );
    },
  });
}

export function createReadItemLifecycleNotificationsAction(
  input: CreateReadItemLifecycleNotificationsActionInput,
) {
  return (sinceSequence?: number | null): void => {
    runItemLifecycleNotificationsReadMutation({
      capabilityServerClient: input.capabilityServerClient,
      isRunningCoverageAction: input.isRunningCoverageAction,
      setIsRunningCoverageAction: input.setIsRunningCoverageAction,
      setCoverageActionErrorMessage: input.setCoverageActionErrorMessage,
      setLastItemLifecycleNotificationsResult: input.setLastItemLifecycleNotificationsResult,
      ...(sinceSequence !== undefined ? { sinceSequence } : {}),
    });
  };
}

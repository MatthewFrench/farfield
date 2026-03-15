import { type Dispatch, type SetStateAction } from "react";
import type { CapabilityServerClient } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import type { DebugAppServerCoverageTurnLifecycleNotificationsResult } from "../DomainModel/DebugAppServerCoverageContracts";
import { runCoverageAsyncMutation } from "./DebugAppServerCoverageMutationActionHelpers";
import { mapTurnLifecycleNotificationsResult } from "./DebugAppServerCoverageTurnLifecycleNotificationMappers";

const COVERAGE_MUTATION_OPERATION_NAME = "debug-coverage-action";
const COVERAGE_TURN_LIFECYCLE_NOTIFICATIONS_LIMIT = 340;

interface RunTurnLifecycleNotificationsReadMutationInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastTurnLifecycleNotificationsResult: Dispatch<
    SetStateAction<DebugAppServerCoverageTurnLifecycleNotificationsResult | null>
  >;
  sinceSequence?: number | null;
}

interface CreateReadTurnLifecycleNotificationsActionInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastTurnLifecycleNotificationsResult: Dispatch<
    SetStateAction<DebugAppServerCoverageTurnLifecycleNotificationsResult | null>
  >;
}

function runTurnLifecycleNotificationsReadMutation(
  input: RunTurnLifecycleNotificationsReadMutationInput,
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
        limit: COVERAGE_TURN_LIFECYCLE_NOTIFICATIONS_LIMIT,
        ...(normalizedSinceSequence !== null ? { sinceSequence: normalizedSinceSequence } : {}),
      });
      input.setLastTurnLifecycleNotificationsResult(
        mapTurnLifecycleNotificationsResult(response, normalizedSinceSequence),
      );
    },
  });
}

export function createReadTurnLifecycleNotificationsAction(
  input: CreateReadTurnLifecycleNotificationsActionInput,
) {
  return (sinceSequence?: number | null): void => {
    runTurnLifecycleNotificationsReadMutation({
      capabilityServerClient: input.capabilityServerClient,
      isRunningCoverageAction: input.isRunningCoverageAction,
      setIsRunningCoverageAction: input.setIsRunningCoverageAction,
      setCoverageActionErrorMessage: input.setCoverageActionErrorMessage,
      setLastTurnLifecycleNotificationsResult: input.setLastTurnLifecycleNotificationsResult,
      ...(sinceSequence !== undefined ? { sinceSequence } : {}),
    });
  };
}

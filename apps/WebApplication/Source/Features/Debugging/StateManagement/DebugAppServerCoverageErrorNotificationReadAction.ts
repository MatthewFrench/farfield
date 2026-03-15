import { type Dispatch, type SetStateAction } from "react";
import type { CapabilityServerClient } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import type { DebugAppServerCoverageErrorNotificationsResult } from "../DomainModel/DebugAppServerCoverageContracts";
import { mapErrorNotificationsResult } from "./DebugAppServerCoverageErrorNotificationMappers";
import { runCoverageAsyncMutation } from "./DebugAppServerCoverageMutationActionHelpers";

const COVERAGE_MUTATION_OPERATION_NAME = "debug-coverage-action";
const COVERAGE_ERROR_NOTIFICATIONS_LIMIT = 320;

interface RunErrorNotificationsReadMutationInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastErrorNotificationsResult: Dispatch<
    SetStateAction<DebugAppServerCoverageErrorNotificationsResult | null>
  >;
  sinceSequence?: number | null;
}

interface CreateReadErrorNotificationsActionInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastErrorNotificationsResult: Dispatch<
    SetStateAction<DebugAppServerCoverageErrorNotificationsResult | null>
  >;
}

function runErrorNotificationsReadMutation(input: RunErrorNotificationsReadMutationInput): void {
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
        limit: COVERAGE_ERROR_NOTIFICATIONS_LIMIT,
        ...(normalizedSinceSequence !== null ? { sinceSequence: normalizedSinceSequence } : {}),
      });
      input.setLastErrorNotificationsResult(
        mapErrorNotificationsResult(response, normalizedSinceSequence),
      );
    },
  });
}

export function createReadErrorNotificationsAction(input: CreateReadErrorNotificationsActionInput) {
  return (sinceSequence?: number | null): void => {
    runErrorNotificationsReadMutation({
      capabilityServerClient: input.capabilityServerClient,
      isRunningCoverageAction: input.isRunningCoverageAction,
      setIsRunningCoverageAction: input.setIsRunningCoverageAction,
      setCoverageActionErrorMessage: input.setCoverageActionErrorMessage,
      setLastErrorNotificationsResult: input.setLastErrorNotificationsResult,
      ...(sinceSequence !== undefined ? { sinceSequence } : {}),
    });
  };
}

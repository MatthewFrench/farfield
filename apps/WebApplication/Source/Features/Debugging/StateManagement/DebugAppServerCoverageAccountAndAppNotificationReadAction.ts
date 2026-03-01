import { type Dispatch, type SetStateAction } from "react";
import type { CapabilityServerClient } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import type { DebugAppServerCoverageAccountAndAppNotificationsResult } from "../DomainModel/DebugAppServerCoverageAccountAndAppNotificationContracts";
import { mapAccountAndAppNotificationsResult } from "./DebugAppServerCoverageAccountAndAppNotificationMappers";
import { runCoverageAsyncMutation } from "./DebugAppServerCoverageMutationActionHelpers";

const COVERAGE_MUTATION_OPERATION_NAME = "debug-coverage-action";
const COVERAGE_ACCOUNT_AND_APP_NOTIFICATIONS_LIMIT = 480;

interface RunAccountAndAppNotificationsReadMutationInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastAccountAndAppNotificationsResult: Dispatch<
    SetStateAction<DebugAppServerCoverageAccountAndAppNotificationsResult | null>
  >;
  sinceSequence?: number | null;
}

interface CreateReadAccountAndAppNotificationsActionInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastAccountAndAppNotificationsResult: Dispatch<
    SetStateAction<DebugAppServerCoverageAccountAndAppNotificationsResult | null>
  >;
}

function runAccountAndAppNotificationsReadMutation(
  input: RunAccountAndAppNotificationsReadMutationInput,
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
        limit: COVERAGE_ACCOUNT_AND_APP_NOTIFICATIONS_LIMIT,
        ...(normalizedSinceSequence !== null ? { sinceSequence: normalizedSinceSequence } : {}),
      });
      input.setLastAccountAndAppNotificationsResult(
        mapAccountAndAppNotificationsResult(response, normalizedSinceSequence),
      );
    },
  });
}

export function createReadAccountAndAppNotificationsAction(
  input: CreateReadAccountAndAppNotificationsActionInput,
) {
  return (sinceSequence?: number | null): void => {
    runAccountAndAppNotificationsReadMutation({
      capabilityServerClient: input.capabilityServerClient,
      isRunningCoverageAction: input.isRunningCoverageAction,
      setIsRunningCoverageAction: input.setIsRunningCoverageAction,
      setCoverageActionErrorMessage: input.setCoverageActionErrorMessage,
      setLastAccountAndAppNotificationsResult: input.setLastAccountAndAppNotificationsResult,
      ...(sinceSequence !== undefined ? { sinceSequence } : {}),
    });
  };
}

import { type Dispatch, type SetStateAction } from "react";
import type { CapabilityServerClient } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import type { DebugAppServerCoverageThreadLifecycleNotificationsResult } from "../DomainModel/DebugAppServerCoverageContracts";
import { runCoverageAsyncMutation } from "./DebugAppServerCoverageMutationActionHelpers";
import { mapThreadLifecycleNotificationsResult } from "./DebugAppServerCoverageThreadLifecycleNotificationMappers";

const COVERAGE_MUTATION_OPERATION_NAME = "debug-coverage-action";
const COVERAGE_THREAD_LIFECYCLE_NOTIFICATIONS_LIMIT = 300;

interface RunThreadLifecycleNotificationsReadMutationInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastThreadLifecycleNotificationsResult: Dispatch<
    SetStateAction<DebugAppServerCoverageThreadLifecycleNotificationsResult | null>
  >;
  sinceSequence?: number | null;
}

interface CreateReadThreadLifecycleNotificationsActionInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastThreadLifecycleNotificationsResult: Dispatch<
    SetStateAction<DebugAppServerCoverageThreadLifecycleNotificationsResult | null>
  >;
}

function runThreadLifecycleNotificationsReadMutation(
  input: RunThreadLifecycleNotificationsReadMutationInput,
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
        limit: COVERAGE_THREAD_LIFECYCLE_NOTIFICATIONS_LIMIT,
        ...(normalizedSinceSequence !== null ? { sinceSequence: normalizedSinceSequence } : {}),
      });
      input.setLastThreadLifecycleNotificationsResult(
        mapThreadLifecycleNotificationsResult(response, normalizedSinceSequence),
      );
    },
  });
}

export function createReadThreadLifecycleNotificationsAction(
  input: CreateReadThreadLifecycleNotificationsActionInput,
) {
  return (sinceSequence?: number | null): void => {
    runThreadLifecycleNotificationsReadMutation({
      capabilityServerClient: input.capabilityServerClient,
      isRunningCoverageAction: input.isRunningCoverageAction,
      setIsRunningCoverageAction: input.setIsRunningCoverageAction,
      setCoverageActionErrorMessage: input.setCoverageActionErrorMessage,
      setLastThreadLifecycleNotificationsResult: input.setLastThreadLifecycleNotificationsResult,
      ...(sinceSequence !== undefined ? { sinceSequence } : {}),
    });
  };
}

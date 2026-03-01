import { type Dispatch, type SetStateAction } from "react";
import type { CapabilityServerClient } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import type { DebugAppServerCoverageThreadProgressNotificationsResult } from "../DomainModel/DebugAppServerCoverageThreadProgressContracts";
import { runCoverageAsyncMutation } from "./DebugAppServerCoverageMutationActionHelpers";
import { mapThreadProgressNotificationsResult } from "./DebugAppServerCoverageThreadProgressNotificationMappers";

const COVERAGE_MUTATION_OPERATION_NAME = "debug-coverage-action";
const COVERAGE_THREAD_PROGRESS_NOTIFICATIONS_LIMIT = 420;

interface RunThreadProgressNotificationsReadMutationInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastThreadProgressNotificationsResult: Dispatch<
    SetStateAction<DebugAppServerCoverageThreadProgressNotificationsResult | null>
  >;
  sinceSequence?: number | null;
}

interface CreateReadThreadProgressNotificationsActionInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastThreadProgressNotificationsResult: Dispatch<
    SetStateAction<DebugAppServerCoverageThreadProgressNotificationsResult | null>
  >;
}

function runThreadProgressNotificationsReadMutation(
  input: RunThreadProgressNotificationsReadMutationInput,
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
        limit: COVERAGE_THREAD_PROGRESS_NOTIFICATIONS_LIMIT,
        ...(normalizedSinceSequence !== null ? { sinceSequence: normalizedSinceSequence } : {}),
      });
      input.setLastThreadProgressNotificationsResult(
        mapThreadProgressNotificationsResult(response, normalizedSinceSequence),
      );
    },
  });
}

export function createReadThreadProgressNotificationsAction(
  input: CreateReadThreadProgressNotificationsActionInput,
) {
  return (sinceSequence?: number | null): void => {
    runThreadProgressNotificationsReadMutation({
      capabilityServerClient: input.capabilityServerClient,
      isRunningCoverageAction: input.isRunningCoverageAction,
      setIsRunningCoverageAction: input.setIsRunningCoverageAction,
      setCoverageActionErrorMessage: input.setCoverageActionErrorMessage,
      setLastThreadProgressNotificationsResult: input.setLastThreadProgressNotificationsResult,
      ...(sinceSequence !== undefined ? { sinceSequence } : {}),
    });
  };
}

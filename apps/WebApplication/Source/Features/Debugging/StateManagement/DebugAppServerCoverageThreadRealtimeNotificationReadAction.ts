import { type Dispatch, type SetStateAction } from "react";
import type { CapabilityServerClient } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import type { DebugAppServerCoverageThreadRealtimeNotificationsResult } from "../DomainModel/DebugAppServerCoverageThreadRealtimeNotificationContracts";
import { runCoverageAsyncMutation } from "./DebugAppServerCoverageMutationActionHelpers";
import { mapThreadRealtimeNotificationsResult } from "./DebugAppServerCoverageThreadRealtimeNotificationMappers";

const COVERAGE_MUTATION_OPERATION_NAME = "debug-coverage-action";
const COVERAGE_THREAD_REALTIME_NOTIFICATIONS_LIMIT = 460;

interface RunThreadRealtimeNotificationsReadMutationInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastThreadRealtimeNotificationsResult: Dispatch<
    SetStateAction<DebugAppServerCoverageThreadRealtimeNotificationsResult | null>
  >;
  sinceSequence?: number | null;
}

interface CreateReadThreadRealtimeNotificationsActionInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastThreadRealtimeNotificationsResult: Dispatch<
    SetStateAction<DebugAppServerCoverageThreadRealtimeNotificationsResult | null>
  >;
}

function runThreadRealtimeNotificationsReadMutation(
  input: RunThreadRealtimeNotificationsReadMutationInput,
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
        limit: COVERAGE_THREAD_REALTIME_NOTIFICATIONS_LIMIT,
        ...(normalizedSinceSequence !== null ? { sinceSequence: normalizedSinceSequence } : {}),
      });
      input.setLastThreadRealtimeNotificationsResult(
        mapThreadRealtimeNotificationsResult(response, normalizedSinceSequence),
      );
    },
  });
}

export function createReadThreadRealtimeNotificationsAction(
  input: CreateReadThreadRealtimeNotificationsActionInput,
) {
  return (sinceSequence?: number | null): void => {
    runThreadRealtimeNotificationsReadMutation({
      capabilityServerClient: input.capabilityServerClient,
      isRunningCoverageAction: input.isRunningCoverageAction,
      setIsRunningCoverageAction: input.setIsRunningCoverageAction,
      setCoverageActionErrorMessage: input.setCoverageActionErrorMessage,
      setLastThreadRealtimeNotificationsResult: input.setLastThreadRealtimeNotificationsResult,
      ...(sinceSequence !== undefined ? { sinceSequence } : {}),
    });
  };
}

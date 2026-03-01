import { type Dispatch, type SetStateAction } from "react";
import type { CapabilityServerClient } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import type {
  DebugAppServerCoverageAuthCompletionEventsResult,
  DebugAppServerCoverageFuzzySessionNotificationsResult,
  DebugAppServerCoverageModelReroutedEventsResult,
  DebugAppServerCoverageNotificationEventsResult,
  DebugAppServerCoveragePendingServerRequestsResult,
  DebugAppServerCoverageServerRequestResolvedEventsResult,
  DebugAppServerCoverageThreadStreamEventsResult,
} from "../DomainModel/DebugAppServerCoverageContracts";
import { mapAuthCompletionEventsResult } from "./DebugAppServerCoverageAuthCompletionEventMappers";
import { mapFuzzySessionNotificationsResult } from "./DebugAppServerCoverageFuzzySessionNotificationMappers";
import { mapModelReroutedEventsResult } from "./DebugAppServerCoverageModelReroutedEventMappers";
import { mapNotificationEventsResult } from "./DebugAppServerCoverageNotificationEventMappers";
import { mapPendingServerRequestsResult } from "./DebugAppServerCoveragePendingServerRequestMappers";
import { mapServerRequestResolvedEventsResult } from "./DebugAppServerCoverageServerRequestResolvedEventMappers";
import { mapThreadStreamEventsResult } from "./DebugAppServerCoverageThreadStreamEventMappers";

const COVERAGE_MUTATION_OPERATION_NAME = "debug-coverage-action";
const COVERAGE_ACTION_ERROR_PREFIX = "Unable to run coverage action: ";
const COVERAGE_AUTH_COMPLETION_EVENTS_LIMIT = 200;
const COVERAGE_SERVER_REQUEST_RESOLVED_EVENTS_LIMIT = 220;
const COVERAGE_FUZZY_SESSION_NOTIFICATIONS_LIMIT = 240;
const COVERAGE_MODEL_REROUTED_EVENTS_LIMIT = 260;

interface RunCoverageAsyncMutationInput {
  isRunningCoverageAction: boolean;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  run: () => Promise<void>;
}

interface RunNotificationEventsReadMutationInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastNotificationEventsResult: Dispatch<
    SetStateAction<DebugAppServerCoverageNotificationEventsResult | null>
  >;
  sinceSequence?: number | null;
}

interface RunPendingServerRequestsReadMutationInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastPendingServerRequestsResult: Dispatch<
    SetStateAction<DebugAppServerCoveragePendingServerRequestsResult | null>
  >;
}

interface RunAuthCompletionEventsReadMutationInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastAuthCompletionEventsResult: Dispatch<
    SetStateAction<DebugAppServerCoverageAuthCompletionEventsResult | null>
  >;
  sinceSequence?: number | null;
}

interface RunServerRequestResolvedEventsReadMutationInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastServerRequestResolvedEventsResult: Dispatch<
    SetStateAction<DebugAppServerCoverageServerRequestResolvedEventsResult | null>
  >;
  sinceSequence?: number | null;
}

interface RunFuzzySessionNotificationsReadMutationInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastFuzzySessionNotificationsResult: Dispatch<
    SetStateAction<DebugAppServerCoverageFuzzySessionNotificationsResult | null>
  >;
  sinceSequence?: number | null;
}

interface RunModelReroutedEventsReadMutationInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastModelReroutedEventsResult: Dispatch<
    SetStateAction<DebugAppServerCoverageModelReroutedEventsResult | null>
  >;
  sinceSequence?: number | null;
}

interface CreateReadNotificationEventsActionInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastNotificationEventsResult: Dispatch<
    SetStateAction<DebugAppServerCoverageNotificationEventsResult | null>
  >;
}

interface CreateReadPendingServerRequestsActionInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastPendingServerRequestsResult: Dispatch<
    SetStateAction<DebugAppServerCoveragePendingServerRequestsResult | null>
  >;
}

interface CreateReadAuthCompletionEventsActionInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastAuthCompletionEventsResult: Dispatch<
    SetStateAction<DebugAppServerCoverageAuthCompletionEventsResult | null>
  >;
}

interface CreateReadServerRequestResolvedEventsActionInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastServerRequestResolvedEventsResult: Dispatch<
    SetStateAction<DebugAppServerCoverageServerRequestResolvedEventsResult | null>
  >;
}

interface CreateReadFuzzySessionNotificationsActionInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastFuzzySessionNotificationsResult: Dispatch<
    SetStateAction<DebugAppServerCoverageFuzzySessionNotificationsResult | null>
  >;
}

interface CreateReadModelReroutedEventsActionInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastModelReroutedEventsResult: Dispatch<
    SetStateAction<DebugAppServerCoverageModelReroutedEventsResult | null>
  >;
}

interface CreateReadThreadStreamEventsActionInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastThreadStreamEventsResult: Dispatch<
    SetStateAction<DebugAppServerCoverageThreadStreamEventsResult | null>
  >;
}

function toErrorMessage<ErrorType>(error: ErrorType): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}

export function runCoverageAsyncMutation(input: RunCoverageAsyncMutationInput): void {
  if (input.isRunningCoverageAction) {
    return;
  }

  input.setIsRunningCoverageAction(true);
  input.setCoverageActionErrorMessage("");

  void (async () => {
    try {
      await input.run();
    } catch (error) {
      input.setCoverageActionErrorMessage(
        `${COVERAGE_ACTION_ERROR_PREFIX}${toErrorMessage(error)}`,
      );
    } finally {
      input.setIsRunningCoverageAction(false);
    }
  })();
}

function runNotificationEventsReadMutation(input: RunNotificationEventsReadMutationInput): void {
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
        ...(normalizedSinceSequence !== null ? { sinceSequence: normalizedSinceSequence } : {}),
      });
      input.setLastNotificationEventsResult(
        mapNotificationEventsResult(response, normalizedSinceSequence),
      );
    },
  });
}

function runPendingServerRequestsReadMutation(
  input: RunPendingServerRequestsReadMutationInput,
): void {
  runCoverageAsyncMutation({
    isRunningCoverageAction: input.isRunningCoverageAction,
    setIsRunningCoverageAction: input.setIsRunningCoverageAction,
    setCoverageActionErrorMessage: input.setCoverageActionErrorMessage,
    run: async () => {
      const response = await input.capabilityServerClient.readPendingServerRequests({
        actionName: COVERAGE_MUTATION_OPERATION_NAME,
      });
      input.setLastPendingServerRequestsResult(mapPendingServerRequestsResult(response));
    },
  });
}

function runAuthCompletionEventsReadMutation(
  input: RunAuthCompletionEventsReadMutationInput,
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
        limit: COVERAGE_AUTH_COMPLETION_EVENTS_LIMIT,
        ...(normalizedSinceSequence !== null ? { sinceSequence: normalizedSinceSequence } : {}),
      });
      input.setLastAuthCompletionEventsResult(
        mapAuthCompletionEventsResult(response, normalizedSinceSequence),
      );
    },
  });
}

function runServerRequestResolvedEventsReadMutation(
  input: RunServerRequestResolvedEventsReadMutationInput,
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
        limit: COVERAGE_SERVER_REQUEST_RESOLVED_EVENTS_LIMIT,
        ...(normalizedSinceSequence !== null ? { sinceSequence: normalizedSinceSequence } : {}),
      });
      input.setLastServerRequestResolvedEventsResult(
        mapServerRequestResolvedEventsResult(response, normalizedSinceSequence),
      );
    },
  });
}

function runFuzzySessionNotificationsReadMutation(
  input: RunFuzzySessionNotificationsReadMutationInput,
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
        limit: COVERAGE_FUZZY_SESSION_NOTIFICATIONS_LIMIT,
        ...(normalizedSinceSequence !== null ? { sinceSequence: normalizedSinceSequence } : {}),
      });
      input.setLastFuzzySessionNotificationsResult(
        mapFuzzySessionNotificationsResult(response, normalizedSinceSequence),
      );
    },
  });
}

function runModelReroutedEventsReadMutation(input: RunModelReroutedEventsReadMutationInput): void {
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
        limit: COVERAGE_MODEL_REROUTED_EVENTS_LIMIT,
        ...(normalizedSinceSequence !== null ? { sinceSequence: normalizedSinceSequence } : {}),
      });
      input.setLastModelReroutedEventsResult(
        mapModelReroutedEventsResult(response, normalizedSinceSequence),
      );
    },
  });
}

export function createReadNotificationEventsAction(input: CreateReadNotificationEventsActionInput) {
  return (sinceSequence?: number | null): void => {
    runNotificationEventsReadMutation({
      capabilityServerClient: input.capabilityServerClient,
      isRunningCoverageAction: input.isRunningCoverageAction,
      setIsRunningCoverageAction: input.setIsRunningCoverageAction,
      setCoverageActionErrorMessage: input.setCoverageActionErrorMessage,
      setLastNotificationEventsResult: input.setLastNotificationEventsResult,
      ...(sinceSequence !== undefined ? { sinceSequence } : {}),
    });
  };
}

export function createReadAuthCompletionEventsAction(
  input: CreateReadAuthCompletionEventsActionInput,
) {
  return (sinceSequence?: number | null): void => {
    runAuthCompletionEventsReadMutation({
      capabilityServerClient: input.capabilityServerClient,
      isRunningCoverageAction: input.isRunningCoverageAction,
      setIsRunningCoverageAction: input.setIsRunningCoverageAction,
      setCoverageActionErrorMessage: input.setCoverageActionErrorMessage,
      setLastAuthCompletionEventsResult: input.setLastAuthCompletionEventsResult,
      ...(sinceSequence !== undefined ? { sinceSequence } : {}),
    });
  };
}

export function createReadServerRequestResolvedEventsAction(
  input: CreateReadServerRequestResolvedEventsActionInput,
) {
  return (sinceSequence?: number | null): void => {
    runServerRequestResolvedEventsReadMutation({
      capabilityServerClient: input.capabilityServerClient,
      isRunningCoverageAction: input.isRunningCoverageAction,
      setIsRunningCoverageAction: input.setIsRunningCoverageAction,
      setCoverageActionErrorMessage: input.setCoverageActionErrorMessage,
      setLastServerRequestResolvedEventsResult: input.setLastServerRequestResolvedEventsResult,
      ...(sinceSequence !== undefined ? { sinceSequence } : {}),
    });
  };
}

export function createReadFuzzySessionNotificationsAction(
  input: CreateReadFuzzySessionNotificationsActionInput,
) {
  return (sinceSequence?: number | null): void => {
    runFuzzySessionNotificationsReadMutation({
      capabilityServerClient: input.capabilityServerClient,
      isRunningCoverageAction: input.isRunningCoverageAction,
      setIsRunningCoverageAction: input.setIsRunningCoverageAction,
      setCoverageActionErrorMessage: input.setCoverageActionErrorMessage,
      setLastFuzzySessionNotificationsResult: input.setLastFuzzySessionNotificationsResult,
      ...(sinceSequence !== undefined ? { sinceSequence } : {}),
    });
  };
}

export function createReadModelReroutedEventsAction(
  input: CreateReadModelReroutedEventsActionInput,
) {
  return (sinceSequence?: number | null): void => {
    runModelReroutedEventsReadMutation({
      capabilityServerClient: input.capabilityServerClient,
      isRunningCoverageAction: input.isRunningCoverageAction,
      setIsRunningCoverageAction: input.setIsRunningCoverageAction,
      setCoverageActionErrorMessage: input.setCoverageActionErrorMessage,
      setLastModelReroutedEventsResult: input.setLastModelReroutedEventsResult,
      ...(sinceSequence !== undefined ? { sinceSequence } : {}),
    });
  };
}

export function createReadPendingServerRequestsAction(
  input: CreateReadPendingServerRequestsActionInput,
) {
  return (): void => {
    runPendingServerRequestsReadMutation({
      capabilityServerClient: input.capabilityServerClient,
      isRunningCoverageAction: input.isRunningCoverageAction,
      setIsRunningCoverageAction: input.setIsRunningCoverageAction,
      setCoverageActionErrorMessage: input.setCoverageActionErrorMessage,
      setLastPendingServerRequestsResult: input.setLastPendingServerRequestsResult,
    });
  };
}

export function createReadThreadStreamEventsAction(input: CreateReadThreadStreamEventsActionInput) {
  return (threadId: string, sinceSequence?: number | null): void => {
    const normalizedThreadId = threadId.trim();
    if (normalizedThreadId.length === 0) {
      return;
    }

    const normalizedSinceSequence =
      sinceSequence === undefined || sinceSequence === null ? null : sinceSequence;
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
        const response = await input.capabilityServerClient.readThreadStreamEvents({
          actionName: COVERAGE_MUTATION_OPERATION_NAME,
          threadId: normalizedThreadId,
          ...(normalizedSinceSequence !== null ? { sinceSequence: normalizedSinceSequence } : {}),
        });
        input.setLastThreadStreamEventsResult(
          mapThreadStreamEventsResult(response, normalizedSinceSequence),
        );
      },
    });
  };
}

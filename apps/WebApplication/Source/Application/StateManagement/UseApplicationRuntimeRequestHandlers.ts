import { type Dispatch, type SetStateAction, useCallback, useRef } from "react";
import { WebShellSessionBootstrapClient } from "@/Application/DataAccess/WebShellSessionBootstrapClient";
import { ApiAuthenticationErrorClassifier } from "@/Application/DomainModel/ApiAuthenticationErrorClassifier";
import { ApiSessionBootstrapCoordinator } from "@/Application/StateManagement/ApiSessionBootstrapCoordinator";
import { STARTUP_CRITICAL_EVENTS_SESSION_OPERATION } from "@/Application/StateManagement/CoreDataStartupRequestProfile";
import { UserInterfaceActionRequestBuilder } from "@/Application/StateManagement/UserInterfaceActionRequestBuilder";
import { shouldIgnoreUiErrorMessage } from "@/Features/Debugging/StateManagement/TrackedUserInterfaceErrorPolicy";
import {
  TrackedUserInterfaceErrorReporter,
  type TrackedUserInterfaceErrorReportInput,
} from "@/Features/Debugging/StateManagement/TrackedUserInterfaceErrorReporter";
import type { ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import { toErrorMessage } from "@/Shared/Errors/ErrorMessage";
import { resolveRuntimeRequestErrorDescriptor } from "@/Shared/Errors/RuntimeRequestErrorDescriptor";

interface ActionRequestOptions {
  actionId: string;
  requestOptions: ApiRequestOptions;
}

const RUNTIME_REQUEST_ERROR_OPERATION = "runtime-request-error";
const RUNTIME_REQUEST_ERROR_HANDLER_NAME =
  "UseApplicationRuntimeRequestHandlers.handleRuntimeRequestError";
const RUNTIME_REQUEST_ERROR_HANDLER_DETAIL_KEY = "handler";
const API_SESSION_BOOTSTRAP_EMPTY_ERROR_MESSAGE = "";
const RUNTIME_REQUEST_ERROR_DEDUPLICATION_WINDOW_MILLISECONDS = 5_000;
const RUNTIME_REQUEST_ERROR_DEDUPLICATION_MAXIMUM_ENTRIES = 200;

interface RuntimeRequestErrorReportContract {
  operation: string;
  actionId: string;
  trackingErrorMessage: string;
  bannerErrorMessage: string;
}

type RuntimeRequestErrorDeduplicationStore = Map<string, number>;

interface ApiSessionTokenRequirementStateInput {
  setRequiresApiSessionToken: Dispatch<SetStateAction<boolean>>;
  setApiSessionBootstrapErrorMessage: Dispatch<SetStateAction<string>>;
}

interface ApiSessionReadyStateInput extends ApiSessionTokenRequirementStateInput {
  requiresApiSessionToken: boolean;
  apiSessionBootstrapErrorMessage: string;
}

function clearApiSessionBootstrapErrorMessage(
  setApiSessionBootstrapErrorMessage: Dispatch<SetStateAction<string>>,
): void {
  setApiSessionBootstrapErrorMessage(API_SESSION_BOOTSTRAP_EMPTY_ERROR_MESSAGE);
}

function applyApiSessionTokenRequiredState(input: ApiSessionTokenRequirementStateInput): void {
  input.setRequiresApiSessionToken(true);
  clearApiSessionBootstrapErrorMessage(input.setApiSessionBootstrapErrorMessage);
}

function applyApiSessionReadyState(input: ApiSessionReadyStateInput): void {
  if (input.requiresApiSessionToken) {
    input.setRequiresApiSessionToken(false);
  }
  if (input.apiSessionBootstrapErrorMessage.length > 0) {
    clearApiSessionBootstrapErrorMessage(input.setApiSessionBootstrapErrorMessage);
  }
}

function createRuntimeRequestErrorReportContract(
  rawMessage: string,
  actionId: string,
): RuntimeRequestErrorReportContract {
  const runtimeErrorDescriptor = resolveRuntimeRequestErrorDescriptor({
    rawMessage,
    defaultOperation: RUNTIME_REQUEST_ERROR_OPERATION,
    actionId,
  });
  return {
    operation: runtimeErrorDescriptor.operation,
    actionId,
    trackingErrorMessage: runtimeErrorDescriptor.trackingErrorMessage,
    bannerErrorMessage: runtimeErrorDescriptor.bannerErrorMessage,
  };
}

function buildRuntimeRequestErrorDeduplicationKey(
  reportContract: RuntimeRequestErrorReportContract,
): string {
  return `${reportContract.operation}:${reportContract.trackingErrorMessage}`;
}

function pruneRuntimeRequestErrorDeduplicationStore(
  deduplicationStore: RuntimeRequestErrorDeduplicationStore,
  nowMilliseconds: number,
): void {
  for (const [deduplicationKey, recordedAtMilliseconds] of deduplicationStore.entries()) {
    if (
      nowMilliseconds - recordedAtMilliseconds >
      RUNTIME_REQUEST_ERROR_DEDUPLICATION_WINDOW_MILLISECONDS
    ) {
      deduplicationStore.delete(deduplicationKey);
    }
  }

  if (deduplicationStore.size <= RUNTIME_REQUEST_ERROR_DEDUPLICATION_MAXIMUM_ENTRIES) {
    return;
  }

  const sortedEntries = [...deduplicationStore.entries()].sort((left, right) => left[1] - right[1]);
  const overflowEntryCount =
    deduplicationStore.size - RUNTIME_REQUEST_ERROR_DEDUPLICATION_MAXIMUM_ENTRIES;
  for (let index = 0; index < overflowEntryCount; index += 1) {
    const staleEntry = sortedEntries[index];
    if (staleEntry === undefined) {
      break;
    }
    deduplicationStore.delete(staleEntry[0]);
  }
}

function shouldSuppressDuplicateRuntimeRequestError(
  deduplicationStore: RuntimeRequestErrorDeduplicationStore,
  deduplicationKey: string,
  nowMilliseconds: number,
): boolean {
  pruneRuntimeRequestErrorDeduplicationStore(deduplicationStore, nowMilliseconds);
  const previousRecordedAtMilliseconds = deduplicationStore.get(deduplicationKey);
  deduplicationStore.set(deduplicationKey, nowMilliseconds);
  if (previousRecordedAtMilliseconds === undefined) {
    return false;
  }

  return (
    nowMilliseconds - previousRecordedAtMilliseconds <=
    RUNTIME_REQUEST_ERROR_DEDUPLICATION_WINDOW_MILLISECONDS
  );
}

export interface UseApplicationRuntimeRequestHandlersInput {
  trackedUserInterfaceErrorReporter: TrackedUserInterfaceErrorReporter;
  userInterfaceActionRequestBuilder: UserInterfaceActionRequestBuilder;
  webShellSessionBootstrapClient: WebShellSessionBootstrapClient;
  apiAuthenticationErrorClassifier: ApiAuthenticationErrorClassifier;
  apiSessionBootstrapCoordinator: ApiSessionBootstrapCoordinator;
  requiresApiSessionToken: boolean;
  apiSessionBootstrapErrorMessage: string;
  setRequiresApiSessionToken: Dispatch<SetStateAction<boolean>>;
  setApiSessionBootstrapErrorMessage: Dispatch<SetStateAction<string>>;
  setErrorMessage: Dispatch<SetStateAction<string>>;
}

export interface ApplicationRuntimeRequestHandlers {
  reportTrackedUserInterfaceError: (input: TrackedUserInterfaceErrorReportInput) => Promise<void>;
  buildActionRequestOptions: (actionName: string) => ActionRequestOptions;
  handleRuntimeRequestError: <ErrorType>(error: ErrorType) => void;
  ensureApiSessionBootstrapped: () => Promise<boolean>;
}

export function useApplicationRuntimeRequestHandlers(
  input: UseApplicationRuntimeRequestHandlersInput,
): ApplicationRuntimeRequestHandlers {
  const runtimeRequestErrorDeduplicationStoreRef = useRef<RuntimeRequestErrorDeduplicationStore>(
    new Map<string, number>(),
  );

  const reportTrackedUserInterfaceError = useCallback(
    async (reportInput: TrackedUserInterfaceErrorReportInput): Promise<void> => {
      await input.trackedUserInterfaceErrorReporter.report(reportInput);
    },
    [input.trackedUserInterfaceErrorReporter],
  );

  const buildActionRequestOptions = useCallback(
    (actionName: string): ActionRequestOptions => {
      return input.userInterfaceActionRequestBuilder.create(actionName);
    },
    [input.userInterfaceActionRequestBuilder],
  );

  const handleRuntimeRequestError = useCallback(
    <ErrorType>(error: ErrorType): void => {
      const message = toErrorMessage(error);
      if (input.apiAuthenticationErrorClassifier.isApiTokenAuthenticationError(message)) {
        input.apiSessionBootstrapCoordinator.markApiTokenRequired();
        applyApiSessionTokenRequiredState({
          setRequiresApiSessionToken: input.setRequiresApiSessionToken,
          setApiSessionBootstrapErrorMessage: input.setApiSessionBootstrapErrorMessage,
        });
        return;
      }

      const actionId = input.userInterfaceActionRequestBuilder.create(
        RUNTIME_REQUEST_ERROR_OPERATION,
      ).actionId;
      const runtimeRequestErrorReport = createRuntimeRequestErrorReportContract(message, actionId);
      const deduplicationKey = buildRuntimeRequestErrorDeduplicationKey(runtimeRequestErrorReport);
      const nowMilliseconds = Date.now();
      const shouldSuppressRuntimeRequestError = shouldSuppressDuplicateRuntimeRequestError(
        runtimeRequestErrorDeduplicationStoreRef.current,
        deduplicationKey,
        nowMilliseconds,
      );
      if (shouldSuppressRuntimeRequestError) {
        return;
      }

      void input.trackedUserInterfaceErrorReporter.report({
        operation: runtimeRequestErrorReport.operation,
        actionId: runtimeRequestErrorReport.actionId,
        threadId: null,
        error: runtimeRequestErrorReport.trackingErrorMessage,
        details: {
          [RUNTIME_REQUEST_ERROR_HANDLER_DETAIL_KEY]: RUNTIME_REQUEST_ERROR_HANDLER_NAME,
        },
      });
      if (shouldIgnoreUiErrorMessage(runtimeRequestErrorReport.trackingErrorMessage)) {
        return;
      }
      input.setErrorMessage(runtimeRequestErrorReport.bannerErrorMessage);
    },
    [
      input.apiAuthenticationErrorClassifier,
      input.apiSessionBootstrapCoordinator,
      input.trackedUserInterfaceErrorReporter,
      input.userInterfaceActionRequestBuilder,
      input.setApiSessionBootstrapErrorMessage,
      input.setErrorMessage,
      input.setRequiresApiSessionToken,
      runtimeRequestErrorDeduplicationStoreRef,
    ],
  );

  const ensureApiSessionBootstrapped = useCallback(async (): Promise<boolean> => {
    let bootstrapDecision;
    try {
      bootstrapDecision = await input.apiSessionBootstrapCoordinator.ensureSession(() => {
        const actionRequest = input.userInterfaceActionRequestBuilder.create(
          STARTUP_CRITICAL_EVENTS_SESSION_OPERATION,
        );
        return input.webShellSessionBootstrapClient.bootstrapWithRequestOptions(
          actionRequest.requestOptions,
        );
      });
    } catch (error) {
      handleRuntimeRequestError(error);
      return false;
    }

    if (bootstrapDecision.isReady) {
      applyApiSessionReadyState({
        requiresApiSessionToken: input.requiresApiSessionToken,
        apiSessionBootstrapErrorMessage: input.apiSessionBootstrapErrorMessage,
        setRequiresApiSessionToken: input.setRequiresApiSessionToken,
        setApiSessionBootstrapErrorMessage: input.setApiSessionBootstrapErrorMessage,
      });
      return true;
    }

    if (bootstrapDecision.requiresApiToken) {
      applyApiSessionTokenRequiredState({
        setRequiresApiSessionToken: input.setRequiresApiSessionToken,
        setApiSessionBootstrapErrorMessage: input.setApiSessionBootstrapErrorMessage,
      });
    }
    return false;
  }, [
    input.apiSessionBootstrapCoordinator,
    input.apiSessionBootstrapErrorMessage.length,
    handleRuntimeRequestError,
    input.requiresApiSessionToken,
    input.userInterfaceActionRequestBuilder,
    input.webShellSessionBootstrapClient,
    input.setApiSessionBootstrapErrorMessage,
    input.setRequiresApiSessionToken,
  ]);

  return {
    reportTrackedUserInterfaceError,
    buildActionRequestOptions,
    handleRuntimeRequestError,
    ensureApiSessionBootstrapped,
  };
}

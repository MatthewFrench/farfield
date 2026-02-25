import {
  useCallback,
  type Dispatch,
  type SetStateAction
} from "react";
import {
  bootstrapEventsSession
} from "@/Application/DataAccess/WebShellApi";
import { ApiAuthenticationErrorClassifier } from "@/Application/DomainModel/ApiAuthenticationErrorClassifier";
import { ApiSessionBootstrapCoordinator } from "@/Application/StateManagement/ApiSessionBootstrapCoordinator";
import { UserInterfaceActionRequestBuilder } from "@/Application/StateManagement/UserInterfaceActionRequestBuilder";
import type { ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import {
  toErrorMessage
} from "@/Shared/Errors/ErrorMessage";
import {
  resolveRuntimeRequestErrorDescriptor
} from "@/Shared/Errors/RuntimeRequestErrorDescriptor";
import {
  TrackedUserInterfaceErrorReporter,
  type TrackedUserInterfaceErrorReportInput
} from "@/Features/Debugging/StateManagement/TrackedUserInterfaceErrorReporter";

interface ActionRequestOptions {
  actionId: string;
  requestOptions: ApiRequestOptions;
}

export interface UseApplicationRuntimeRequestHandlersInput {
  trackedUserInterfaceErrorReporter: TrackedUserInterfaceErrorReporter;
  userInterfaceActionRequestBuilder: UserInterfaceActionRequestBuilder;
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
  input: UseApplicationRuntimeRequestHandlersInput
): ApplicationRuntimeRequestHandlers {
  const reportTrackedUserInterfaceError = useCallback(
    async (reportInput: TrackedUserInterfaceErrorReportInput): Promise<void> => {
      await input.trackedUserInterfaceErrorReporter.report(reportInput);
    },
    [input.trackedUserInterfaceErrorReporter]
  );

  const buildActionRequestOptions = useCallback(
    (actionName: string): ActionRequestOptions => {
      return input.userInterfaceActionRequestBuilder.create(actionName);
    },
    [input.userInterfaceActionRequestBuilder]
  );

  const handleRuntimeRequestError = useCallback(<ErrorType,>(error: ErrorType): void => {
    const message = toErrorMessage(error);
    if (input.apiAuthenticationErrorClassifier.isApiTokenAuthenticationError(message)) {
      input.apiSessionBootstrapCoordinator.markApiTokenRequired();
      input.setRequiresApiSessionToken(true);
      input.setApiSessionBootstrapErrorMessage("");
      return;
    }

    const runtimeErrorOperation = "runtime-request-error";
    const actionId = input.userInterfaceActionRequestBuilder.create(runtimeErrorOperation).actionId;
    const runtimeErrorDescriptor = resolveRuntimeRequestErrorDescriptor({
      rawMessage: message,
      defaultOperation: runtimeErrorOperation,
      actionId
    });
    void input.trackedUserInterfaceErrorReporter.report({
      operation: runtimeErrorDescriptor.operation,
      actionId,
      threadId: null,
      error: runtimeErrorDescriptor.trackingErrorMessage,
      details: {
        handler: "UseApplicationRuntimeRequestHandlers.handleRuntimeRequestError"
      }
    });
    input.setErrorMessage(runtimeErrorDescriptor.bannerErrorMessage);
  }, [
    input.apiAuthenticationErrorClassifier,
    input.apiSessionBootstrapCoordinator,
    input.trackedUserInterfaceErrorReporter,
    input.userInterfaceActionRequestBuilder,
    input.setApiSessionBootstrapErrorMessage,
    input.setErrorMessage,
    input.setRequiresApiSessionToken
  ]);

  const ensureApiSessionBootstrapped = useCallback(async (): Promise<boolean> => {
    const bootstrapDecision = await input.apiSessionBootstrapCoordinator.ensureSession(
      () => bootstrapEventsSession()
    );

    if (bootstrapDecision.isReady) {
      if (input.requiresApiSessionToken) {
        input.setRequiresApiSessionToken(false);
      }
      if (input.apiSessionBootstrapErrorMessage.length > 0) {
        input.setApiSessionBootstrapErrorMessage("");
      }
      return true;
    }

    if (bootstrapDecision.requiresApiToken) {
      input.setRequiresApiSessionToken(true);
      input.setApiSessionBootstrapErrorMessage("");
    }
    return false;
  }, [
    input.apiSessionBootstrapCoordinator,
    input.apiSessionBootstrapErrorMessage.length,
    input.requiresApiSessionToken,
    input.setApiSessionBootstrapErrorMessage,
    input.setRequiresApiSessionToken
  ]);

  return {
    reportTrackedUserInterfaceError,
    buildActionRequestOptions,
    handleRuntimeRequestError,
    ensureApiSessionBootstrapped
  };
}

import { type Dispatch, type SetStateAction, useCallback } from "react";
import { WebShellSessionBootstrapClient } from "@/Application/DataAccess/WebShellSessionBootstrapClient";
import { ApiSessionBootstrapCoordinator } from "@/Application/StateManagement/ApiSessionBootstrapCoordinator";
import { type PushClientState } from "@/Features/PushNotifications/DomainModel/PushClientContracts";
import { PushNotificationToolbarActionCoordinator } from "@/Features/PushNotifications/StateManagement/PushNotificationToolbarActionCoordinator";
import { toErrorMessage } from "@/Shared/Errors/ErrorMessage";

const API_TOKEN_REQUIRED_ERROR_MESSAGE = "API token is required";
const INVALID_API_TOKEN_ERROR_MESSAGE = "Invalid API token";

export interface UseApplicationPushFeatureCompositionInput {
  apiSessionBootstrapCoordinator: ApiSessionBootstrapCoordinator;
  webShellSessionBootstrapClient: WebShellSessionBootstrapClient;
  apiSessionTokenDraft: string;
  pushNotificationToolbarActionCoordinator: PushNotificationToolbarActionCoordinator;
  loadCoreDataTracked: () => Promise<void>;
  loadSelectedThreadIfPresent: () => Promise<void>;
  setApiSessionTokenDraft: Dispatch<SetStateAction<string>>;
  setApiSessionBootstrapErrorMessage: Dispatch<SetStateAction<string>>;
  setErrorMessage: Dispatch<SetStateAction<string>>;
  setIsApiSessionBootstrapPending: Dispatch<SetStateAction<boolean>>;
  setIsEnablingPushNotifications: Dispatch<SetStateAction<boolean>>;
  setPushClientState: Dispatch<SetStateAction<PushClientState>>;
  setRequiresApiSessionToken: Dispatch<SetStateAction<boolean>>;
}

export interface ApplicationPushFeatureComposition {
  submitApiSessionToken: () => Promise<void>;
  refreshPushClientState: () => Promise<void>;
  enablePushNotificationsFromToolbar: () => Promise<void>;
}

export function useApplicationPushFeatureComposition(
  input: UseApplicationPushFeatureCompositionInput,
): ApplicationPushFeatureComposition {
  const submitApiSessionToken = useCallback(async (): Promise<void> => {
    const tokenValue = input.apiSessionTokenDraft.trim();
    if (tokenValue.length === 0) {
      input.setApiSessionBootstrapErrorMessage(API_TOKEN_REQUIRED_ERROR_MESSAGE);
      return;
    }

    input.setIsApiSessionBootstrapPending(true);
    try {
      const bootstrapDecision = await input.apiSessionBootstrapCoordinator.submitApiToken(
        tokenValue,
        (apiToken) => input.webShellSessionBootstrapClient.bootstrapWithApiToken(apiToken),
      );
      if (!bootstrapDecision.isReady) {
        if (bootstrapDecision.requiresApiToken) {
          input.apiSessionBootstrapCoordinator.markApiTokenRequired();
        }
        input.setRequiresApiSessionToken(true);
        input.setApiSessionBootstrapErrorMessage(INVALID_API_TOKEN_ERROR_MESSAGE);
        return;
      }

      input.setRequiresApiSessionToken(false);
      input.setApiSessionBootstrapErrorMessage("");
      input.setApiSessionTokenDraft("");
      await input.loadCoreDataTracked();
      await input.loadSelectedThreadIfPresent();
    } catch (error) {
      input.setApiSessionBootstrapErrorMessage(toErrorMessage(error));
    } finally {
      input.setIsApiSessionBootstrapPending(false);
    }
  }, [
    input.apiSessionBootstrapCoordinator,
    input.apiSessionTokenDraft,
    input.loadCoreDataTracked,
    input.loadSelectedThreadIfPresent,
    input.webShellSessionBootstrapClient,
    input.setApiSessionBootstrapErrorMessage,
    input.setApiSessionTokenDraft,
    input.setIsApiSessionBootstrapPending,
    input.setRequiresApiSessionToken,
  ]);

  const refreshPushClientState = useCallback(async (): Promise<void> => {
    await input.pushNotificationToolbarActionCoordinator.refreshPushClientState({
      onPushClientStateRead: input.setPushClientState,
    });
  }, [input.pushNotificationToolbarActionCoordinator, input.setPushClientState]);

  const enablePushNotificationsFromToolbar = useCallback(async (): Promise<void> => {
    await input.pushNotificationToolbarActionCoordinator.enablePushNotificationsFromToolbar({
      onSetEnablingPushNotifications: input.setIsEnablingPushNotifications,
      onPushClientStateRead: input.setPushClientState,
      onSetErrorMessage: input.setErrorMessage,
    });
  }, [
    input.pushNotificationToolbarActionCoordinator,
    input.setErrorMessage,
    input.setIsEnablingPushNotifications,
    input.setPushClientState,
  ]);

  return {
    submitApiSessionToken,
    refreshPushClientState,
    enablePushNotificationsFromToolbar,
  };
}

import {
  useCallback,
  type Dispatch,
  type SetStateAction
} from "react";
import {
  bootstrapEventsSession
} from "@/Application/DataAccess/WebShellApi";
import { ApiSessionBootstrapCoordinator } from "@/Application/StateManagement/ApiSessionBootstrapCoordinator";
import {
  toErrorMessage
} from "@/Shared/Errors/ErrorMessage";
import {
  type PushClientState
} from "@/Features/PushNotifications/DomainModel/PushClientContracts";
import {
  PushNotificationToolbarActionCoordinator
} from "@/Features/PushNotifications/StateManagement/PushNotificationToolbarActionCoordinator";

export interface UseApplicationPushFeatureCompositionInput {
  apiSessionBootstrapCoordinator: ApiSessionBootstrapCoordinator;
  apiSessionTokenDraft: string;
  pushNotificationToolbarActionCoordinator: PushNotificationToolbarActionCoordinator;
  refreshAll: () => Promise<void>;
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
  input: UseApplicationPushFeatureCompositionInput
): ApplicationPushFeatureComposition {
  const submitApiSessionToken = useCallback(async (): Promise<void> => {
    const tokenValue = input.apiSessionTokenDraft.trim();
    if (tokenValue.length === 0) {
      input.setApiSessionBootstrapErrorMessage("API token is required");
      return;
    }

    input.setIsApiSessionBootstrapPending(true);
    try {
      const bootstrapDecision = await input.apiSessionBootstrapCoordinator.submitApiToken(
        tokenValue,
        (apiToken) => bootstrapEventsSession({ apiToken })
      );
      if (!bootstrapDecision.isReady) {
        if (bootstrapDecision.requiresApiToken) {
          input.apiSessionBootstrapCoordinator.markApiTokenRequired();
        }
        input.setRequiresApiSessionToken(true);
        input.setApiSessionBootstrapErrorMessage("Invalid API token");
        return;
      }

      input.setRequiresApiSessionToken(false);
      input.setApiSessionBootstrapErrorMessage("");
      input.setApiSessionTokenDraft("");
      await input.refreshAll();
    } catch (error) {
      input.setApiSessionBootstrapErrorMessage(toErrorMessage(error));
    } finally {
      input.setIsApiSessionBootstrapPending(false);
    }
  }, [
    input.apiSessionBootstrapCoordinator,
    input.apiSessionTokenDraft,
    input.refreshAll,
    input.setApiSessionBootstrapErrorMessage,
    input.setApiSessionTokenDraft,
    input.setIsApiSessionBootstrapPending,
    input.setRequiresApiSessionToken
  ]);

  const refreshPushClientState = useCallback(async (): Promise<void> => {
    await input.pushNotificationToolbarActionCoordinator.refreshPushClientState({
      onPushClientStateRead: input.setPushClientState
    });
  }, [input.pushNotificationToolbarActionCoordinator, input.setPushClientState]);

  const enablePushNotificationsFromToolbar = useCallback(async (): Promise<void> => {
    await input.pushNotificationToolbarActionCoordinator.enablePushNotificationsFromToolbar({
      onSetEnablingPushNotifications: input.setIsEnablingPushNotifications,
      onPushClientStateRead: input.setPushClientState,
      onSetErrorMessage: input.setErrorMessage
    });
  }, [
    input.pushNotificationToolbarActionCoordinator,
    input.setErrorMessage,
    input.setIsEnablingPushNotifications,
    input.setPushClientState
  ]);

  return {
    submitApiSessionToken,
    refreshPushClientState,
    enablePushNotificationsFromToolbar
  };
}

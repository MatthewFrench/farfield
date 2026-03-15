import { type Dispatch, type SetStateAction, useCallback } from "react";
import { WebShellSessionBootstrapClient } from "@/Application/DataAccess/WebShellSessionBootstrapClient";
import { ApiSessionBootstrapCoordinator } from "@/Application/StateManagement/ApiSessionBootstrapCoordinator";
import {
  type PushLocalCertificateAuthorityStatusResponse,
  type PushReceiptLatestResponse,
  type PushSendLatestResponse,
  type PushServerClient,
  type PushStatusResponse,
  type PushTestResponse,
} from "@/Features/PushNotifications/DataAccess/PushServerClient";
import { type PushClientState } from "@/Features/PushNotifications/DomainModel/PushClientContracts";
import { PushDiagnosticsRefreshStateOwner } from "@/Features/PushNotifications/StateManagement/PushDiagnosticsRefreshStateOwner";
import { PushNotificationToolbarActionCoordinator } from "@/Features/PushNotifications/StateManagement/PushNotificationToolbarActionCoordinator";
import { toErrorMessage } from "@/Shared/Errors/ErrorMessage";

const API_TOKEN_REQUIRED_ERROR_MESSAGE = "API token is required";
const INVALID_API_TOKEN_ERROR_MESSAGE = "Invalid API token";
const PUSH_SETTINGS_REFRESH_OPERATION_NAME = "push.settings.refresh";
const PUSH_TEST_OPERATION_NAME = "push.test";

export interface SendPushTestNotificationFromSettingsInput {
  threadId: string;
  turnId: string;
}

export interface UseApplicationPushFeatureCompositionInput {
  apiSessionBootstrapCoordinator: ApiSessionBootstrapCoordinator;
  webShellSessionBootstrapClient: WebShellSessionBootstrapClient;
  apiSessionTokenDraft: string;
  pushServerClient: PushServerClient;
  pushNotificationToolbarActionCoordinator: PushNotificationToolbarActionCoordinator;
  pushDiagnosticsRefreshStateOwner: PushDiagnosticsRefreshStateOwner;
  loadCoreDataTracked: () => Promise<void>;
  loadSelectedThreadIfPresent: () => Promise<void>;
  setApiSessionTokenDraft: Dispatch<SetStateAction<string>>;
  setApiSessionBootstrapErrorMessage: Dispatch<SetStateAction<string>>;
  setErrorMessage: Dispatch<SetStateAction<string>>;
  setIsApiSessionBootstrapPending: Dispatch<SetStateAction<boolean>>;
  setIsEnablingPushNotifications: Dispatch<SetStateAction<boolean>>;
  setPushClientState: Dispatch<SetStateAction<PushClientState>>;
  setPushStatus: Dispatch<SetStateAction<PushStatusResponse | null>>;
  setLatestPushReceipt: Dispatch<SetStateAction<PushReceiptLatestResponse | null>>;
  setLatestPushSend: Dispatch<SetStateAction<PushSendLatestResponse | null>>;
  setPushLocalCertificateAuthorityStatus: Dispatch<
    SetStateAction<PushLocalCertificateAuthorityStatusResponse | null>
  >;
  setPushSettingsErrorMessage: Dispatch<SetStateAction<string>>;
  setPushTestResult: Dispatch<SetStateAction<PushTestResponse | null>>;
  setIsRefreshingPushSettings: Dispatch<SetStateAction<boolean>>;
  setIsSendingPushTestNotification: Dispatch<SetStateAction<boolean>>;
  setRequiresApiSessionToken: Dispatch<SetStateAction<boolean>>;
}

export interface ApplicationPushFeatureComposition {
  submitApiSessionToken: () => Promise<void>;
  refreshPushClientState: () => Promise<void>;
  ensureFreshPushSettingsDiagnostics: () => Promise<void>;
  refreshPushSettingsDiagnostics: () => Promise<void>;
  enablePushNotificationsFromToolbar: () => Promise<void>;
  sendPushTestNotificationFromSettings: (
    input: SendPushTestNotificationFromSettingsInput,
  ) => Promise<void>;
}

export function useApplicationPushFeatureComposition(
  input: UseApplicationPushFeatureCompositionInput,
): ApplicationPushFeatureComposition {
  const clearPushSettingsErrorMessage = useCallback((): void => {
    input.setPushSettingsErrorMessage("");
  }, [input.setPushSettingsErrorMessage]);

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

  const runPushSettingsDiagnosticsRefreshTask = useCallback(async (): Promise<void> => {
    input.setIsRefreshingPushSettings(true);
    clearPushSettingsErrorMessage();
    try {
      const [pushStatus, latestPushReceipt, latestPushSend, pushLocalCertificateAuthorityStatus] =
        await Promise.all([
          input.pushServerClient.readPushStatus(),
          input.pushServerClient.readLatestPushReceipt(),
          input.pushServerClient.readLatestPushSend(),
          input.pushServerClient.readPushLocalCertificateAuthorityStatus(),
          refreshPushClientState(),
        ]);

      input.setPushStatus(pushStatus);
      input.setLatestPushReceipt(latestPushReceipt);
      input.setLatestPushSend(latestPushSend);
      input.setPushLocalCertificateAuthorityStatus(pushLocalCertificateAuthorityStatus);
    } catch (error) {
      input.setPushSettingsErrorMessage(
        `${PUSH_SETTINGS_REFRESH_OPERATION_NAME}: ${toErrorMessage(error)}`,
      );
    } finally {
      input.setIsRefreshingPushSettings(false);
    }
  }, [
    clearPushSettingsErrorMessage,
    refreshPushClientState,
    input.pushServerClient,
    input.setIsRefreshingPushSettings,
    input.setLatestPushReceipt,
    input.setLatestPushSend,
    input.setPushLocalCertificateAuthorityStatus,
    input.setPushSettingsErrorMessage,
    input.setPushStatus,
  ]);

  const refreshPushSettingsDiagnostics = useCallback(async (): Promise<void> => {
    await input.pushDiagnosticsRefreshStateOwner.runRefresh({
      refreshTask: runPushSettingsDiagnosticsRefreshTask,
      forceRefresh: true,
    });
  }, [input.pushDiagnosticsRefreshStateOwner, runPushSettingsDiagnosticsRefreshTask]);

  const ensureFreshPushSettingsDiagnostics = useCallback(async (): Promise<void> => {
    await input.pushDiagnosticsRefreshStateOwner.runRefresh({
      refreshTask: runPushSettingsDiagnosticsRefreshTask,
      forceRefresh: false,
    });
  }, [input.pushDiagnosticsRefreshStateOwner, runPushSettingsDiagnosticsRefreshTask]);

  const enablePushNotificationsFromToolbar = useCallback(async (): Promise<void> => {
    clearPushSettingsErrorMessage();
    await input.pushNotificationToolbarActionCoordinator.enablePushNotificationsFromToolbar({
      onSetEnablingPushNotifications: input.setIsEnablingPushNotifications,
      onPushClientStateRead: input.setPushClientState,
      onSetErrorMessage: input.setErrorMessage,
    });
    await refreshPushSettingsDiagnostics();
  }, [
    clearPushSettingsErrorMessage,
    input.pushNotificationToolbarActionCoordinator,
    input.setErrorMessage,
    input.setIsEnablingPushNotifications,
    input.setPushClientState,
    refreshPushSettingsDiagnostics,
  ]);

  const sendPushTestNotificationFromSettings = useCallback(
    async (sendInput: SendPushTestNotificationFromSettingsInput): Promise<void> => {
      input.setIsSendingPushTestNotification(true);
      clearPushSettingsErrorMessage();
      try {
        const pushTestResult = await input.pushServerClient.sendPushTestNotification({
          threadId: sendInput.threadId,
          turnId: sendInput.turnId,
        });
        input.setPushTestResult(pushTestResult);
        await refreshPushSettingsDiagnostics();
      } catch (error) {
        input.setPushSettingsErrorMessage(`${PUSH_TEST_OPERATION_NAME}: ${toErrorMessage(error)}`);
      } finally {
        input.setIsSendingPushTestNotification(false);
      }
    },
    [
      clearPushSettingsErrorMessage,
      input.pushServerClient,
      input.setIsSendingPushTestNotification,
      input.setPushSettingsErrorMessage,
      input.setPushTestResult,
      refreshPushSettingsDiagnostics,
    ],
  );

  return {
    submitApiSessionToken,
    refreshPushClientState,
    ensureFreshPushSettingsDiagnostics,
    refreshPushSettingsDiagnostics,
    enablePushNotificationsFromToolbar,
    sendPushTestNotificationFromSettings,
  };
}

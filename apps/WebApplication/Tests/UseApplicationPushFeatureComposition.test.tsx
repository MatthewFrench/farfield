import { act, cleanup, render } from "@testing-library/react";
import { type SetStateAction, useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApiEventsSessionBootstrapResponse } from "../Source/Application/DataAccess/WebShellApi";
import { WebShellSessionBootstrapClient } from "../Source/Application/DataAccess/WebShellSessionBootstrapClient";
import { ApiSessionBootstrapCoordinator } from "../Source/Application/StateManagement/ApiSessionBootstrapCoordinator";
import {
  type ApplicationPushFeatureComposition,
  type UseApplicationPushFeatureCompositionInput,
  useApplicationPushFeatureComposition,
} from "../Source/Application/StateManagement/UseApplicationPushFeatureComposition";
import { PushClientStateManager } from "../Source/Features/PushNotifications/DataAccess/PushClientStateManager";
import { type PushClientState } from "../Source/Features/PushNotifications/DomainModel/PushClientContracts";
import { PushNotificationToolbarActionCoordinator } from "../Source/Features/PushNotifications/StateManagement/PushNotificationToolbarActionCoordinator";

const API_TOKEN_REQUIRED_ERROR_MESSAGE = "API token is required";
const INVALID_API_TOKEN_ERROR_MESSAGE = "Invalid API token";
const FUTURE_BOOTSTRAP_EXPIRY_ISO8601 = "2099-01-01T00:00:00.000Z";

interface ApplicationPushFeatureCompositionHarnessProperties {
  input: UseApplicationPushFeatureCompositionInput;
  onSnapshot: (snapshot: ApplicationPushFeatureComposition) => void;
}

function createBootstrapResponse(input: {
  authRequired: boolean;
  bootstrapped: boolean;
  expiresAt: string | null;
}): ApiEventsSessionBootstrapResponse {
  return {
    ok: true,
    authRequired: input.authRequired,
    bootstrapped: input.bootstrapped,
    expiresAt: input.expiresAt,
  };
}

function createUnsupportedPushClientState(): PushClientState {
  return {
    supported: false,
    serviceWorkerRegistered: false,
    permission: "unsupported",
    subscribed: false,
  };
}

function createPushNotificationToolbarActionCoordinator(): PushNotificationToolbarActionCoordinator {
  return new PushNotificationToolbarActionCoordinator({
    pushClientStateManager: new PushClientStateManager(),
    unsupportedPushClientState: createUnsupportedPushClientState(),
  });
}

function ApplicationPushFeatureCompositionHarness(
  properties: ApplicationPushFeatureCompositionHarnessProperties,
): React.JSX.Element {
  const { input, onSnapshot } = properties;
  const pushFeatureComposition = useApplicationPushFeatureComposition(input);

  useEffect(() => {
    onSnapshot(pushFeatureComposition);
  }, [onSnapshot, pushFeatureComposition]);

  return <div data-testid="application-push-feature-composition-harness" />;
}

function mountApplicationPushFeatureComposition(
  input: UseApplicationPushFeatureCompositionInput,
): ApplicationPushFeatureComposition {
  const onSnapshot = vi.fn<(snapshot: ApplicationPushFeatureComposition) => void>();
  render(<ApplicationPushFeatureCompositionHarness input={input} onSnapshot={onSnapshot} />);

  const firstSnapshotCall = onSnapshot.mock.calls[0];
  if (firstSnapshotCall === undefined) {
    throw new Error("Expected application push feature composition snapshot");
  }
  return firstSnapshotCall[0];
}

function createHarness(overrides?: { apiSessionTokenDraft?: string }) {
  const apiSessionBootstrapCoordinator = new ApiSessionBootstrapCoordinator();
  const markApiTokenRequiredSpy = vi.spyOn(apiSessionBootstrapCoordinator, "markApiTokenRequired");
  const webShellSessionBootstrapClient = new WebShellSessionBootstrapClient();
  const bootstrapWithApiTokenSpy = vi
    .spyOn(webShellSessionBootstrapClient, "bootstrapWithApiToken")
    .mockResolvedValue(
      createBootstrapResponse({
        authRequired: true,
        bootstrapped: true,
        expiresAt: FUTURE_BOOTSTRAP_EXPIRY_ISO8601,
      }),
    );
  const loadCoreDataTracked = vi.fn<() => Promise<void>>().mockResolvedValue();
  const loadSelectedThreadIfPresent = vi.fn<() => Promise<void>>().mockResolvedValue();
  const setApiSessionTokenDraft = vi.fn<(value: SetStateAction<string>) => void>();
  const setApiSessionBootstrapErrorMessage = vi.fn<(value: SetStateAction<string>) => void>();
  const setErrorMessage = vi.fn<(value: SetStateAction<string>) => void>();
  const setIsApiSessionBootstrapPending = vi.fn<(value: SetStateAction<boolean>) => void>();
  const setIsEnablingPushNotifications = vi.fn<(value: SetStateAction<boolean>) => void>();
  const setPushClientState = vi.fn<(value: SetStateAction<PushClientState>) => void>();
  const setRequiresApiSessionToken = vi.fn<(value: SetStateAction<boolean>) => void>();

  const input: UseApplicationPushFeatureCompositionInput = {
    apiSessionBootstrapCoordinator,
    webShellSessionBootstrapClient,
    apiSessionTokenDraft: overrides?.apiSessionTokenDraft ?? "token-value",
    pushNotificationToolbarActionCoordinator: createPushNotificationToolbarActionCoordinator(),
    loadCoreDataTracked,
    loadSelectedThreadIfPresent,
    setApiSessionTokenDraft,
    setApiSessionBootstrapErrorMessage,
    setErrorMessage,
    setIsApiSessionBootstrapPending,
    setIsEnablingPushNotifications,
    setPushClientState,
    setRequiresApiSessionToken,
  };

  return {
    input,
    bootstrapWithApiTokenSpy,
    markApiTokenRequiredSpy,
    loadCoreDataTracked,
    loadSelectedThreadIfPresent,
    setApiSessionTokenDraft,
    setApiSessionBootstrapErrorMessage,
    setErrorMessage,
    setIsApiSessionBootstrapPending,
    setIsEnablingPushNotifications,
    setPushClientState,
    setRequiresApiSessionToken,
  };
}

describe("useApplicationPushFeatureComposition", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("submits a trimmed api token through the bootstrap client and refreshes runtime state when ready", async () => {
    const harness = createHarness({
      apiSessionTokenDraft: "  token-value  ",
    });
    const pushFeatureComposition = mountApplicationPushFeatureComposition(harness.input);

    await act(async () => {
      await pushFeatureComposition.submitApiSessionToken();
    });

    expect(harness.bootstrapWithApiTokenSpy).toHaveBeenCalledWith("token-value");
    expect(harness.setIsApiSessionBootstrapPending).toHaveBeenCalledWith(true);
    expect(harness.setIsApiSessionBootstrapPending).toHaveBeenCalledWith(false);
    expect(harness.setRequiresApiSessionToken).toHaveBeenCalledWith(false);
    expect(harness.setApiSessionBootstrapErrorMessage).toHaveBeenCalledWith("");
    expect(harness.setApiSessionTokenDraft).toHaveBeenCalledWith("");
    expect(harness.loadCoreDataTracked).toHaveBeenCalledTimes(1);
    expect(harness.loadSelectedThreadIfPresent).toHaveBeenCalledTimes(1);
    expect(harness.markApiTokenRequiredSpy).not.toHaveBeenCalled();
  });

  it("marks api token as required when bootstrap response indicates token is still required", async () => {
    const harness = createHarness();
    harness.bootstrapWithApiTokenSpy.mockResolvedValue(
      createBootstrapResponse({
        authRequired: true,
        bootstrapped: false,
        expiresAt: null,
      }),
    );
    const pushFeatureComposition = mountApplicationPushFeatureComposition(harness.input);

    await act(async () => {
      await pushFeatureComposition.submitApiSessionToken();
    });

    expect(harness.bootstrapWithApiTokenSpy).toHaveBeenCalledWith("token-value");
    expect(harness.markApiTokenRequiredSpy).toHaveBeenCalledTimes(1);
    expect(harness.setRequiresApiSessionToken).toHaveBeenCalledWith(true);
    expect(harness.setApiSessionBootstrapErrorMessage).toHaveBeenCalledWith(
      INVALID_API_TOKEN_ERROR_MESSAGE,
    );
    expect(harness.loadCoreDataTracked).not.toHaveBeenCalled();
    expect(harness.loadSelectedThreadIfPresent).not.toHaveBeenCalled();
  });

  it("does not call bootstrap when token draft is blank", async () => {
    const harness = createHarness({
      apiSessionTokenDraft: "   ",
    });
    const pushFeatureComposition = mountApplicationPushFeatureComposition(harness.input);

    await act(async () => {
      await pushFeatureComposition.submitApiSessionToken();
    });

    expect(harness.bootstrapWithApiTokenSpy).not.toHaveBeenCalled();
    expect(harness.setApiSessionBootstrapErrorMessage).toHaveBeenCalledWith(
      API_TOKEN_REQUIRED_ERROR_MESSAGE,
    );
    expect(harness.setIsApiSessionBootstrapPending).not.toHaveBeenCalled();
  });
});

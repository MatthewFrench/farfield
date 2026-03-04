import { act, cleanup, render } from "@testing-library/react";
import { type SetStateAction, useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApiEventsSessionBootstrapResponse } from "../Source/Application/DataAccess/WebShellApi";
import { WebShellSessionBootstrapClient } from "../Source/Application/DataAccess/WebShellSessionBootstrapClient";
import { ApiAuthenticationErrorClassifier } from "../Source/Application/DomainModel/ApiAuthenticationErrorClassifier";
import { ApiSessionBootstrapCoordinator } from "../Source/Application/StateManagement/ApiSessionBootstrapCoordinator";
import { STARTUP_CRITICAL_EVENTS_SESSION_OPERATION } from "../Source/Application/StateManagement/CoreDataStartupRequestProfile";
import {
  type ApplicationRuntimeRequestHandlers,
  type UseApplicationRuntimeRequestHandlersInput,
  useApplicationRuntimeRequestHandlers,
} from "../Source/Application/StateManagement/UseApplicationRuntimeRequestHandlers";
import { UserInterfaceActionRequestBuilder } from "../Source/Application/StateManagement/UserInterfaceActionRequestBuilder";
import { TrackedUserInterfaceErrorReporter } from "../Source/Features/Debugging/StateManagement/TrackedUserInterfaceErrorReporter";
import { resolveRuntimeRequestErrorDescriptor } from "../Source/Shared/Errors/RuntimeRequestErrorDescriptor";

interface RuntimeRequestHandlersHarnessProperties {
  input: UseApplicationRuntimeRequestHandlersInput;
  onSnapshot: (snapshot: ApplicationRuntimeRequestHandlers) => void;
}

const RUNTIME_REQUEST_ERROR_OPERATION = "runtime-request-error";
const RUNTIME_REQUEST_ERROR_HANDLER_NAME =
  "UseApplicationRuntimeRequestHandlers.handleRuntimeRequestError";
const API_TOKEN_AUTHENTICATION_ERROR_MESSAGE = "Unauthorized: missing or invalid X-Farfield-Token";
const REQUEST_CANCELED_ERROR_MESSAGE =
  "Request canceled for /api/threads/thread-1?includeTurns=true";
const FUTURE_BOOTSTRAP_EXPIRY_ISO8601 = "2099-01-01T00:00:00.000Z";

function RuntimeRequestHandlersHarness(
  properties: RuntimeRequestHandlersHarnessProperties,
): React.JSX.Element {
  const { input, onSnapshot } = properties;
  const runtimeRequestHandlers = useApplicationRuntimeRequestHandlers(input);

  useEffect(() => {
    onSnapshot(runtimeRequestHandlers);
  }, [onSnapshot, runtimeRequestHandlers]);

  return <div data-testid="runtime-request-handlers-harness" />;
}

function createActionIdentifierReader(): () => string {
  let actionSequence = 0;
  return (): string => {
    actionSequence += 1;
    return `action-${String(actionSequence)}`;
  };
}

function mountRuntimeRequestHandlers(
  input: UseApplicationRuntimeRequestHandlersInput,
): ApplicationRuntimeRequestHandlers {
  const onSnapshot = vi.fn<(snapshot: ApplicationRuntimeRequestHandlers) => void>();

  render(<RuntimeRequestHandlersHarness input={input} onSnapshot={onSnapshot} />);

  const firstSnapshotCall = onSnapshot.mock.calls[0];
  if (firstSnapshotCall === undefined) {
    throw new Error("Expected runtime request handlers snapshot to be captured");
  }

  return firstSnapshotCall[0];
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

function readFirstInvocationCallOrder(invocationCallOrder: number[], functionName: string): number {
  const firstInvocationCallOrder = invocationCallOrder[0];
  if (firstInvocationCallOrder === undefined) {
    throw new Error(`Expected ${functionName} to be called at least once`);
  }
  return firstInvocationCallOrder;
}

function createRuntimeRequestHandlersHarness(overrides?: {
  requiresApiSessionToken?: boolean;
  apiSessionBootstrapErrorMessage?: string;
}) {
  const setRequiresApiSessionToken = vi.fn<(value: SetStateAction<boolean>) => void>();
  const setApiSessionBootstrapErrorMessage = vi.fn<(value: SetStateAction<string>) => void>();
  const setErrorMessage = vi.fn<(value: SetStateAction<string>) => void>();

  const trackedUserInterfaceErrorReporter = new TrackedUserInterfaceErrorReporter({
    setErrorMessage: (_errorMessage: string): void => {},
  });
  const reportTrackedUserInterfaceErrorSpy = vi
    .spyOn(trackedUserInterfaceErrorReporter, "report")
    .mockResolvedValue(undefined);

  const userInterfaceActionRequestBuilder = new UserInterfaceActionRequestBuilder(
    createActionIdentifierReader(),
  );
  const buildActionRequestSpy = vi.spyOn(userInterfaceActionRequestBuilder, "create");

  const apiSessionBootstrapCoordinator = new ApiSessionBootstrapCoordinator();
  const markApiTokenRequiredSpy = vi.spyOn(apiSessionBootstrapCoordinator, "markApiTokenRequired");
  const webShellSessionBootstrapClient = new WebShellSessionBootstrapClient();
  const bootstrapWithRequestOptionsSpy = vi
    .spyOn(webShellSessionBootstrapClient, "bootstrapWithRequestOptions")
    .mockResolvedValue(
      createBootstrapResponse({
        authRequired: true,
        bootstrapped: true,
        expiresAt: FUTURE_BOOTSTRAP_EXPIRY_ISO8601,
      }),
    );

  const input: UseApplicationRuntimeRequestHandlersInput = {
    trackedUserInterfaceErrorReporter,
    userInterfaceActionRequestBuilder,
    webShellSessionBootstrapClient,
    apiAuthenticationErrorClassifier: new ApiAuthenticationErrorClassifier(),
    apiSessionBootstrapCoordinator,
    requiresApiSessionToken: overrides?.requiresApiSessionToken ?? false,
    apiSessionBootstrapErrorMessage: overrides?.apiSessionBootstrapErrorMessage ?? "",
    setRequiresApiSessionToken,
    setApiSessionBootstrapErrorMessage,
    setErrorMessage,
  };

  return {
    input,
    markApiTokenRequiredSpy,
    bootstrapWithRequestOptionsSpy,
    buildActionRequestSpy,
    reportTrackedUserInterfaceErrorSpy,
    setRequiresApiSessionToken,
    setApiSessionBootstrapErrorMessage,
    setErrorMessage,
  };
}

describe("useApplicationRuntimeRequestHandlers", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("reports non-authentication runtime request errors with operation metadata and a banner message", () => {
    const harness = createRuntimeRequestHandlersHarness();
    const runtimeRequestHandlers = mountRuntimeRequestHandlers(harness.input);
    const runtimeError = new Error("thread.refresh failed");

    act(() => {
      runtimeRequestHandlers.handleRuntimeRequestError(runtimeError);
    });

    const expectedDescriptor = resolveRuntimeRequestErrorDescriptor({
      rawMessage: runtimeError.message,
      defaultOperation: RUNTIME_REQUEST_ERROR_OPERATION,
      actionId: "action-1",
    });

    expect(harness.markApiTokenRequiredSpy).not.toHaveBeenCalled();
    expect(harness.buildActionRequestSpy).toHaveBeenCalledWith(RUNTIME_REQUEST_ERROR_OPERATION);
    expect(harness.reportTrackedUserInterfaceErrorSpy).toHaveBeenCalledWith({
      operation: expectedDescriptor.operation,
      actionId: "action-1",
      threadId: null,
      error: expectedDescriptor.trackingErrorMessage,
      details: {
        handler: RUNTIME_REQUEST_ERROR_HANDLER_NAME,
      },
    });
    expect(harness.setErrorMessage).toHaveBeenCalledWith(expectedDescriptor.bannerErrorMessage);
  });

  it("classifies API token authentication runtime errors and activates token-required state deterministically", () => {
    const harness = createRuntimeRequestHandlersHarness();
    const runtimeRequestHandlers = mountRuntimeRequestHandlers(harness.input);

    act(() => {
      runtimeRequestHandlers.handleRuntimeRequestError(
        new Error(API_TOKEN_AUTHENTICATION_ERROR_MESSAGE),
      );
    });

    expect(harness.markApiTokenRequiredSpy).toHaveBeenCalledTimes(1);
    expect(harness.reportTrackedUserInterfaceErrorSpy).not.toHaveBeenCalled();
    expect(harness.setErrorMessage).not.toHaveBeenCalled();
    expect(harness.setRequiresApiSessionToken).toHaveBeenCalledWith(true);
    expect(harness.setApiSessionBootstrapErrorMessage).toHaveBeenCalledWith("");

    expect(
      readFirstInvocationCallOrder(
        harness.markApiTokenRequiredSpy.mock.invocationCallOrder,
        "markApiTokenRequired",
      ),
    ).toBeLessThan(
      readFirstInvocationCallOrder(
        harness.setRequiresApiSessionToken.mock.invocationCallOrder,
        "setRequiresApiSessionToken",
      ),
    );
    expect(
      readFirstInvocationCallOrder(
        harness.setRequiresApiSessionToken.mock.invocationCallOrder,
        "setRequiresApiSessionToken",
      ),
    ).toBeLessThan(
      readFirstInvocationCallOrder(
        harness.setApiSessionBootstrapErrorMessage.mock.invocationCallOrder,
        "setApiSessionBootstrapErrorMessage",
      ),
    );
  });

  it("suppresses error banners for request-canceled runtime failures", () => {
    const harness = createRuntimeRequestHandlersHarness();
    const runtimeRequestHandlers = mountRuntimeRequestHandlers(harness.input);

    act(() => {
      runtimeRequestHandlers.handleRuntimeRequestError(new Error(REQUEST_CANCELED_ERROR_MESSAGE));
    });

    const expectedDescriptor = resolveRuntimeRequestErrorDescriptor({
      rawMessage: REQUEST_CANCELED_ERROR_MESSAGE,
      defaultOperation: RUNTIME_REQUEST_ERROR_OPERATION,
      actionId: "action-1",
    });

    expect(harness.buildActionRequestSpy).toHaveBeenCalledWith(RUNTIME_REQUEST_ERROR_OPERATION);
    expect(harness.reportTrackedUserInterfaceErrorSpy).toHaveBeenCalledWith({
      operation: expectedDescriptor.operation,
      actionId: "action-1",
      threadId: null,
      error: expectedDescriptor.trackingErrorMessage,
      details: {
        handler: RUNTIME_REQUEST_ERROR_HANDLER_NAME,
      },
    });
    expect(harness.setErrorMessage).not.toHaveBeenCalled();
  });

  it("deduplicates repeated runtime request failures with the same normalized message", () => {
    const harness = createRuntimeRequestHandlersHarness();
    const runtimeRequestHandlers = mountRuntimeRequestHandlers(harness.input);
    const runtimeError = new Error(
      "Request timed out for /api/events/session after 120000ms requestId req_deduped_1",
    );

    act(() => {
      runtimeRequestHandlers.handleRuntimeRequestError(runtimeError);
      runtimeRequestHandlers.handleRuntimeRequestError(runtimeError);
    });

    expect(harness.reportTrackedUserInterfaceErrorSpy).toHaveBeenCalledTimes(1);
    expect(harness.setErrorMessage).toHaveBeenCalledTimes(1);
  });

  it("clears token-required and bootstrap-error state after a ready bootstrap decision", async () => {
    const harness = createRuntimeRequestHandlersHarness({
      requiresApiSessionToken: true,
      apiSessionBootstrapErrorMessage: "invalid API token",
    });
    harness.bootstrapWithRequestOptionsSpy.mockResolvedValue(
      createBootstrapResponse({
        authRequired: true,
        bootstrapped: true,
        expiresAt: FUTURE_BOOTSTRAP_EXPIRY_ISO8601,
      }),
    );
    const runtimeRequestHandlers = mountRuntimeRequestHandlers(harness.input);

    let bootstrapReady = false;
    await act(async () => {
      bootstrapReady = await runtimeRequestHandlers.ensureApiSessionBootstrapped();
    });

    expect(bootstrapReady).toBe(true);
    expect(harness.bootstrapWithRequestOptionsSpy).toHaveBeenCalledWith({
      actionId: "action-1",
      actionName: STARTUP_CRITICAL_EVENTS_SESSION_OPERATION,
    });
    expect(harness.setRequiresApiSessionToken).toHaveBeenCalledWith(false);
    expect(harness.setApiSessionBootstrapErrorMessage).toHaveBeenCalledWith("");
    expect(
      readFirstInvocationCallOrder(
        harness.setRequiresApiSessionToken.mock.invocationCallOrder,
        "setRequiresApiSessionToken",
      ),
    ).toBeLessThan(
      readFirstInvocationCallOrder(
        harness.setApiSessionBootstrapErrorMessage.mock.invocationCallOrder,
        "setApiSessionBootstrapErrorMessage",
      ),
    );
  });

  it("activates token-required bootstrap state when the bootstrap decision still requires a token", async () => {
    const harness = createRuntimeRequestHandlersHarness({
      apiSessionBootstrapErrorMessage: "stale bootstrap error",
    });
    harness.bootstrapWithRequestOptionsSpy.mockResolvedValue(
      createBootstrapResponse({
        authRequired: true,
        bootstrapped: false,
        expiresAt: null,
      }),
    );
    const runtimeRequestHandlers = mountRuntimeRequestHandlers(harness.input);

    let bootstrapReady = true;
    await act(async () => {
      bootstrapReady = await runtimeRequestHandlers.ensureApiSessionBootstrapped();
    });

    expect(bootstrapReady).toBe(false);
    expect(harness.bootstrapWithRequestOptionsSpy).toHaveBeenCalledWith({
      actionId: "action-1",
      actionName: STARTUP_CRITICAL_EVENTS_SESSION_OPERATION,
    });
    expect(harness.markApiTokenRequiredSpy).not.toHaveBeenCalled();
    expect(harness.setRequiresApiSessionToken).toHaveBeenCalledWith(true);
    expect(harness.setApiSessionBootstrapErrorMessage).toHaveBeenCalledWith("");
    expect(
      readFirstInvocationCallOrder(
        harness.setRequiresApiSessionToken.mock.invocationCallOrder,
        "setRequiresApiSessionToken",
      ),
    ).toBeLessThan(
      readFirstInvocationCallOrder(
        harness.setApiSessionBootstrapErrorMessage.mock.invocationCallOrder,
        "setApiSessionBootstrapErrorMessage",
      ),
    );
  });

  it("retries bootstrap after a connection-class error and clears only the matching banner after success", async () => {
    const harness = createRuntimeRequestHandlersHarness();
    const bootstrapError = new Error(
      "Request timed out for /api/events/session after 120000ms requestId req_bootstrap_retry_1",
    );
    harness.bootstrapWithRequestOptionsSpy
      .mockRejectedValueOnce(bootstrapError)
      .mockResolvedValueOnce(
        createBootstrapResponse({
          authRequired: true,
          bootstrapped: true,
          expiresAt: FUTURE_BOOTSTRAP_EXPIRY_ISO8601,
        }),
      );
    const runtimeRequestHandlers = mountRuntimeRequestHandlers(harness.input);

    let bootstrapReady = false;
    await act(async () => {
      bootstrapReady = await runtimeRequestHandlers.ensureApiSessionBootstrapped();
    });

    const expectedDescriptor = resolveRuntimeRequestErrorDescriptor({
      rawMessage: bootstrapError.message,
      defaultOperation: RUNTIME_REQUEST_ERROR_OPERATION,
      actionId: "action-2",
    });
    const clearErrorMessageStateUpdate = harness.setErrorMessage.mock.calls[1]?.[0] as
      | ((previousErrorMessage: string) => string)
      | undefined;
    if (clearErrorMessageStateUpdate === undefined) {
      throw new Error("Expected a banner-clearing state update callback after successful retry");
    }

    expect(bootstrapReady).toBe(true);
    expect(harness.bootstrapWithRequestOptionsSpy).toHaveBeenCalledTimes(2);
    expect(harness.buildActionRequestSpy).toHaveBeenNthCalledWith(
      1,
      STARTUP_CRITICAL_EVENTS_SESSION_OPERATION,
    );
    expect(harness.buildActionRequestSpy).toHaveBeenNthCalledWith(
      2,
      RUNTIME_REQUEST_ERROR_OPERATION,
    );
    expect(harness.buildActionRequestSpy).toHaveBeenNthCalledWith(
      3,
      STARTUP_CRITICAL_EVENTS_SESSION_OPERATION,
    );
    expect(harness.reportTrackedUserInterfaceErrorSpy).toHaveBeenCalledTimes(1);
    expect(harness.setErrorMessage).toHaveBeenCalledTimes(2);
    expect(harness.setErrorMessage).toHaveBeenNthCalledWith(
      1,
      expectedDescriptor.bannerErrorMessage,
    );
    expect(clearErrorMessageStateUpdate(expectedDescriptor.bannerErrorMessage)).toBe("");
    expect(
      clearErrorMessageStateUpdate(
        "runtime-request-error: thread.refresh failed actionId=action-9",
      ),
    ).toBe("runtime-request-error: thread.refresh failed actionId=action-9");
  });

  it("reports bootstrap read failures through runtime-request-error ownership and returns not-ready", async () => {
    const harness = createRuntimeRequestHandlersHarness();
    const bootstrapError = new Error(
      "Request timed out for /api/events/session after 120000ms requestId req_bootstrap_1",
    );
    harness.bootstrapWithRequestOptionsSpy.mockRejectedValue(bootstrapError);
    const runtimeRequestHandlers = mountRuntimeRequestHandlers(harness.input);

    let bootstrapReady = true;
    await act(async () => {
      bootstrapReady = await runtimeRequestHandlers.ensureApiSessionBootstrapped();
    });

    const expectedDescriptor = resolveRuntimeRequestErrorDescriptor({
      rawMessage: bootstrapError.message,
      defaultOperation: RUNTIME_REQUEST_ERROR_OPERATION,
      actionId: "action-2",
    });

    expect(bootstrapReady).toBe(false);
    expect(harness.bootstrapWithRequestOptionsSpy).toHaveBeenCalledTimes(2);
    expect(harness.buildActionRequestSpy).toHaveBeenNthCalledWith(
      1,
      STARTUP_CRITICAL_EVENTS_SESSION_OPERATION,
    );
    expect(harness.buildActionRequestSpy).toHaveBeenNthCalledWith(
      2,
      RUNTIME_REQUEST_ERROR_OPERATION,
    );
    expect(harness.buildActionRequestSpy).toHaveBeenNthCalledWith(
      3,
      STARTUP_CRITICAL_EVENTS_SESSION_OPERATION,
    );
    expect(harness.buildActionRequestSpy).toHaveBeenNthCalledWith(
      4,
      RUNTIME_REQUEST_ERROR_OPERATION,
    );
    expect(harness.reportTrackedUserInterfaceErrorSpy).toHaveBeenCalledWith({
      operation: expectedDescriptor.operation,
      actionId: "action-2",
      threadId: null,
      error: expectedDescriptor.trackingErrorMessage,
      details: {
        handler: RUNTIME_REQUEST_ERROR_HANDLER_NAME,
      },
    });
    expect(harness.reportTrackedUserInterfaceErrorSpy).toHaveBeenCalledTimes(1);
    expect(harness.setErrorMessage).toHaveBeenCalledTimes(1);
    expect(harness.setErrorMessage).toHaveBeenCalledWith(expectedDescriptor.bannerErrorMessage);
  });

  it("does not retry bootstrap when the first failure is not a connection-class error", async () => {
    const harness = createRuntimeRequestHandlersHarness();
    const bootstrapError = new Error(
      "Request failed for /api/events/session: Unexpected server exception status=500 Internal Server Error requestId req_bootstrap_no_retry_1",
    );
    harness.bootstrapWithRequestOptionsSpy.mockRejectedValue(bootstrapError);
    const runtimeRequestHandlers = mountRuntimeRequestHandlers(harness.input);

    let bootstrapReady = true;
    await act(async () => {
      bootstrapReady = await runtimeRequestHandlers.ensureApiSessionBootstrapped();
    });

    const expectedDescriptor = resolveRuntimeRequestErrorDescriptor({
      rawMessage: bootstrapError.message,
      defaultOperation: RUNTIME_REQUEST_ERROR_OPERATION,
      actionId: "action-2",
    });

    expect(bootstrapReady).toBe(false);
    expect(harness.bootstrapWithRequestOptionsSpy).toHaveBeenCalledTimes(1);
    expect(harness.buildActionRequestSpy).toHaveBeenNthCalledWith(
      1,
      STARTUP_CRITICAL_EVENTS_SESSION_OPERATION,
    );
    expect(harness.buildActionRequestSpy).toHaveBeenNthCalledWith(
      2,
      RUNTIME_REQUEST_ERROR_OPERATION,
    );
    expect(harness.reportTrackedUserInterfaceErrorSpy).toHaveBeenCalledTimes(1);
    expect(harness.reportTrackedUserInterfaceErrorSpy).toHaveBeenCalledWith({
      operation: expectedDescriptor.operation,
      actionId: "action-2",
      threadId: null,
      error: expectedDescriptor.trackingErrorMessage,
      details: {
        handler: RUNTIME_REQUEST_ERROR_HANDLER_NAME,
      },
    });
    expect(harness.setErrorMessage).toHaveBeenCalledTimes(1);
    expect(harness.setErrorMessage).toHaveBeenCalledWith(expectedDescriptor.bannerErrorMessage);
  });
});

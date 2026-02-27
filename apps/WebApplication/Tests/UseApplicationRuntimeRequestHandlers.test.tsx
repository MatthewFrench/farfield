import { act, cleanup, render } from "@testing-library/react";
import { type SetStateAction, useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type ApiEventsSessionBootstrapResponse,
  bootstrapEventsSession,
} from "@/Application/DataAccess/WebShellApi";
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

vi.mock("@/Application/DataAccess/WebShellApi", () => ({
  bootstrapEventsSession: vi.fn(),
}));

interface RuntimeRequestHandlersHarnessProperties {
  input: UseApplicationRuntimeRequestHandlersInput;
  onSnapshot: (snapshot: ApplicationRuntimeRequestHandlers) => void;
}

const RUNTIME_REQUEST_ERROR_OPERATION = "runtime-request-error";
const RUNTIME_REQUEST_ERROR_HANDLER_NAME =
  "UseApplicationRuntimeRequestHandlers.handleRuntimeRequestError";
const API_TOKEN_AUTHENTICATION_ERROR_MESSAGE = "Unauthorized: missing or invalid X-Farfield-Token";
const FUTURE_BOOTSTRAP_EXPIRY_ISO8601 = "2099-01-01T00:00:00.000Z";
const bootstrapEventsSessionMock = vi.mocked(bootstrapEventsSession);

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

  const input: UseApplicationRuntimeRequestHandlersInput = {
    trackedUserInterfaceErrorReporter,
    userInterfaceActionRequestBuilder,
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
    bootstrapEventsSessionMock.mockReset();
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

  it("clears token-required and bootstrap-error state after a ready bootstrap decision", async () => {
    bootstrapEventsSessionMock.mockResolvedValue(
      createBootstrapResponse({
        authRequired: true,
        bootstrapped: true,
        expiresAt: FUTURE_BOOTSTRAP_EXPIRY_ISO8601,
      }),
    );

    const harness = createRuntimeRequestHandlersHarness({
      requiresApiSessionToken: true,
      apiSessionBootstrapErrorMessage: "invalid API token",
    });
    const runtimeRequestHandlers = mountRuntimeRequestHandlers(harness.input);

    let bootstrapReady = false;
    await act(async () => {
      bootstrapReady = await runtimeRequestHandlers.ensureApiSessionBootstrapped();
    });

    expect(bootstrapReady).toBe(true);
    expect(bootstrapEventsSessionMock).toHaveBeenCalledWith(undefined, {
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
    bootstrapEventsSessionMock.mockResolvedValue(
      createBootstrapResponse({
        authRequired: true,
        bootstrapped: false,
        expiresAt: null,
      }),
    );

    const harness = createRuntimeRequestHandlersHarness({
      apiSessionBootstrapErrorMessage: "stale bootstrap error",
    });
    const runtimeRequestHandlers = mountRuntimeRequestHandlers(harness.input);

    let bootstrapReady = true;
    await act(async () => {
      bootstrapReady = await runtimeRequestHandlers.ensureApiSessionBootstrapped();
    });

    expect(bootstrapReady).toBe(false);
    expect(bootstrapEventsSessionMock).toHaveBeenCalledWith(undefined, {
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
});

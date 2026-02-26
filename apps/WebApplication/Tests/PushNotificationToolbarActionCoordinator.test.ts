import { describe, expect, it } from "vitest";
import { type PushClientState } from "@/Features/PushNotifications/DomainModel/PushClientContracts";
import { PushClientStateManager } from "@/Features/PushNotifications/DataAccess/PushClientStateManager";
import {
  PushNotificationToolbarActionCoordinator
} from "@/Features/PushNotifications/StateManagement/PushNotificationToolbarActionCoordinator";

const READ_FAILURE_MESSAGE = "push client state read failed";
const ENABLE_FAILURE_MESSAGE = "push enable failed";
const PUSH_ENABLE_OPERATION_NAME = "push.enable";

interface TestPushClientStateManagerInput {
  pushClientState: PushClientState;
  shouldFailRead?: boolean;
  enableFailureValue?: Error | string | null;
}

class TestPushClientStateManager extends PushClientStateManager {
  private readonly pushClientState: PushClientState;
  private readonly shouldFailRead: boolean;
  private readonly enableFailureValue: Error | string | null;
  private readCallCount = 0;
  private enableCallCount = 0;

  public constructor(input: TestPushClientStateManagerInput) {
    super();
    this.pushClientState = input.pushClientState;
    this.shouldFailRead = input.shouldFailRead ?? false;
    this.enableFailureValue = input.enableFailureValue ?? null;
  }

  public getReadCallCount(): number {
    return this.readCallCount;
  }

  public getEnableCallCount(): number {
    return this.enableCallCount;
  }

  public override async readPushClientState(): Promise<PushClientState> {
    this.readCallCount += 1;
    if (this.shouldFailRead) {
      throw new Error(READ_FAILURE_MESSAGE);
    }
    return this.pushClientState;
  }

  public override async enablePrivateModePushNotifications(): Promise<void> {
    this.enableCallCount += 1;
    if (this.enableFailureValue !== null) {
      throw this.enableFailureValue;
    }
  }
}

const ENABLED_PUSH_CLIENT_STATE: PushClientState = {
  supported: true,
  serviceWorkerRegistered: true,
  permission: "granted",
  subscribed: true
};

const UNSUPPORTED_PUSH_CLIENT_STATE: PushClientState = {
  supported: false,
  serviceWorkerRegistered: false,
  permission: "unsupported",
  subscribed: false
};

function createCoordinator(
  pushClientStateManager: TestPushClientStateManager
): PushNotificationToolbarActionCoordinator {
  return new PushNotificationToolbarActionCoordinator({
    pushClientStateManager,
    unsupportedPushClientState: UNSUPPORTED_PUSH_CLIENT_STATE
  });
}

describe("PushNotificationToolbarActionCoordinator", () => {
  it("refreshes push client state from push client manager", async () => {
    const pushClientStateManager = new TestPushClientStateManager({
      pushClientState: ENABLED_PUSH_CLIENT_STATE
    });
    const coordinator = createCoordinator(pushClientStateManager);
    const observedPushClientStates: PushClientState[] = [];

    await coordinator.refreshPushClientState({
      onPushClientStateRead: (state) => {
        observedPushClientStates.push(state);
      }
    });

    expect(pushClientStateManager.getReadCallCount()).toBe(1);
    expect(observedPushClientStates).toEqual([ENABLED_PUSH_CLIENT_STATE]);
  });

  it("uses unsupported push client state when refresh read fails", async () => {
    const pushClientStateManager = new TestPushClientStateManager({
      pushClientState: ENABLED_PUSH_CLIENT_STATE,
      shouldFailRead: true
    });
    const coordinator = createCoordinator(pushClientStateManager);
    const observedPushClientStates: PushClientState[] = [];

    await coordinator.refreshPushClientState({
      onPushClientStateRead: (state) => {
        observedPushClientStates.push(state);
      }
    });

    expect(pushClientStateManager.getReadCallCount()).toBe(1);
    expect(observedPushClientStates).toEqual([UNSUPPORTED_PUSH_CLIENT_STATE]);
  });

  it("enables push notifications and refreshes push client state", async () => {
    const pushClientStateManager = new TestPushClientStateManager({
      pushClientState: ENABLED_PUSH_CLIENT_STATE
    });
    const coordinator = createCoordinator(pushClientStateManager);
    const enablingStates: boolean[] = [];
    const callbackEvents: string[] = [];
    const observedPushClientStates: PushClientState[] = [];
    const observedErrorMessages: string[] = [];

    await coordinator.enablePushNotificationsFromToolbar({
      onSetEnablingPushNotifications: (isEnabling) => {
        enablingStates.push(isEnabling);
        callbackEvents.push(`enabling:${String(isEnabling)}`);
      },
      onPushClientStateRead: (state) => {
        observedPushClientStates.push(state);
        callbackEvents.push(`state:${state.permission}`);
      },
      onSetErrorMessage: (errorMessage) => {
        observedErrorMessages.push(errorMessage);
        callbackEvents.push(`error:${errorMessage}`);
      }
    });

    expect(pushClientStateManager.getEnableCallCount()).toBe(1);
    expect(pushClientStateManager.getReadCallCount()).toBe(1);
    expect(enablingStates).toEqual([true, false]);
    expect(observedPushClientStates).toEqual([ENABLED_PUSH_CLIENT_STATE]);
    expect(observedErrorMessages).toEqual([]);
    expect(callbackEvents).toEqual(["enabling:true", "state:granted", "enabling:false"]);
  });

  it("uses unsupported state when enable succeeds but refresh read fails", async () => {
    const pushClientStateManager = new TestPushClientStateManager({
      pushClientState: ENABLED_PUSH_CLIENT_STATE,
      shouldFailRead: true
    });
    const coordinator = createCoordinator(pushClientStateManager);
    const enablingStates: boolean[] = [];
    const observedPushClientStates: PushClientState[] = [];
    const observedErrorMessages: string[] = [];

    await coordinator.enablePushNotificationsFromToolbar({
      onSetEnablingPushNotifications: (isEnabling) => {
        enablingStates.push(isEnabling);
      },
      onPushClientStateRead: (state) => {
        observedPushClientStates.push(state);
      },
      onSetErrorMessage: (errorMessage) => {
        observedErrorMessages.push(errorMessage);
      }
    });

    expect(pushClientStateManager.getEnableCallCount()).toBe(1);
    expect(pushClientStateManager.getReadCallCount()).toBe(1);
    expect(observedPushClientStates).toEqual([UNSUPPORTED_PUSH_CLIENT_STATE]);
    expect(observedErrorMessages).toEqual([]);
    expect(enablingStates).toEqual([true, false]);
  });

  it("reports error when enable push notifications fails", async () => {
    const pushClientStateManager = new TestPushClientStateManager({
      pushClientState: ENABLED_PUSH_CLIENT_STATE,
      enableFailureValue: ENABLE_FAILURE_MESSAGE
    });
    const coordinator = createCoordinator(pushClientStateManager);
    const enablingStates: boolean[] = [];
    const observedPushClientStates: PushClientState[] = [];
    const observedErrorMessages: string[] = [];

    await coordinator.enablePushNotificationsFromToolbar({
      onSetEnablingPushNotifications: (isEnabling) => {
        enablingStates.push(isEnabling);
      },
      onPushClientStateRead: (state) => {
        observedPushClientStates.push(state);
      },
      onSetErrorMessage: (errorMessage) => {
        observedErrorMessages.push(errorMessage);
      }
    });

    expect(pushClientStateManager.getEnableCallCount()).toBe(1);
    expect(pushClientStateManager.getReadCallCount()).toBe(0);
    expect(observedPushClientStates).toEqual([]);
    expect(observedErrorMessages).toEqual([
      `${PUSH_ENABLE_OPERATION_NAME}: ${ENABLE_FAILURE_MESSAGE}`
    ]);
    expect(enablingStates).toEqual([true, false]);
  });
});

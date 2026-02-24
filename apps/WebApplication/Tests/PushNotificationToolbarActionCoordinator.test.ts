import { describe, expect, it } from "vitest";
import { type PushClientState } from "@/Features/PushNotifications/DomainModel/PushClientContracts";
import { PushClientStateManager } from "@/Features/PushNotifications/DataAccess/PushClientStateManager";
import {
  PushNotificationToolbarActionCoordinator
} from "@/Features/PushNotifications/StateManagement/PushNotificationToolbarActionCoordinator";

class TestPushClientStateManager extends PushClientStateManager {
  private pushClientState: PushClientState;
  private shouldFailRead: boolean;
  private shouldFailEnable: boolean;
  private readCallCount: number;
  private enableCallCount: number;

  public constructor(input: { pushClientState: PushClientState }) {
    super();
    this.pushClientState = input.pushClientState;
    this.shouldFailRead = false;
    this.shouldFailEnable = false;
    this.readCallCount = 0;
    this.enableCallCount = 0;
  }

  public setShouldFailRead(value: boolean): void {
    this.shouldFailRead = value;
  }

  public setShouldFailEnable(value: boolean): void {
    this.shouldFailEnable = value;
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
      throw new Error("push client state read failed");
    }
    return this.pushClientState;
  }

  public override async enablePrivateModePushNotifications(): Promise<void> {
    this.enableCallCount += 1;
    if (this.shouldFailEnable) {
      throw new Error("push enable failed");
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

describe("PushNotificationToolbarActionCoordinator", () => {
  it("refreshes push client state from push client manager", async () => {
    const pushClientStateManager = new TestPushClientStateManager({
      pushClientState: ENABLED_PUSH_CLIENT_STATE
    });
    const coordinator = new PushNotificationToolbarActionCoordinator({
      pushClientStateManager,
      unsupportedPushClientState: UNSUPPORTED_PUSH_CLIENT_STATE
    });
    let observedPushClientState: PushClientState | null = null;

    await coordinator.refreshPushClientState({
      onPushClientStateRead: (state) => {
        observedPushClientState = state;
      }
    });

    expect(pushClientStateManager.getReadCallCount()).toBe(1);
    expect(observedPushClientState).toEqual(ENABLED_PUSH_CLIENT_STATE);
  });

  it("uses unsupported push client state when refresh read fails", async () => {
    const pushClientStateManager = new TestPushClientStateManager({
      pushClientState: ENABLED_PUSH_CLIENT_STATE
    });
    pushClientStateManager.setShouldFailRead(true);
    const coordinator = new PushNotificationToolbarActionCoordinator({
      pushClientStateManager,
      unsupportedPushClientState: UNSUPPORTED_PUSH_CLIENT_STATE
    });
    let observedPushClientState: PushClientState | null = null;

    await coordinator.refreshPushClientState({
      onPushClientStateRead: (state) => {
        observedPushClientState = state;
      }
    });

    expect(pushClientStateManager.getReadCallCount()).toBe(1);
    expect(observedPushClientState).toEqual(UNSUPPORTED_PUSH_CLIENT_STATE);
  });

  it("enables push notifications and refreshes push client state", async () => {
    const pushClientStateManager = new TestPushClientStateManager({
      pushClientState: ENABLED_PUSH_CLIENT_STATE
    });
    const coordinator = new PushNotificationToolbarActionCoordinator({
      pushClientStateManager,
      unsupportedPushClientState: UNSUPPORTED_PUSH_CLIENT_STATE
    });
    const enablingStates: boolean[] = [];
    let observedPushClientState: PushClientState | null = null;
    let observedErrorMessage = "";

    await coordinator.enablePushNotificationsFromToolbar({
      onSetEnablingPushNotifications: (isEnabling) => {
        enablingStates.push(isEnabling);
      },
      onPushClientStateRead: (state) => {
        observedPushClientState = state;
      },
      onSetErrorMessage: (errorMessage) => {
        observedErrorMessage = errorMessage;
      }
    });

    expect(pushClientStateManager.getEnableCallCount()).toBe(1);
    expect(pushClientStateManager.getReadCallCount()).toBe(1);
    expect(enablingStates).toEqual([true, false]);
    expect(observedPushClientState).toEqual(ENABLED_PUSH_CLIENT_STATE);
    expect(observedErrorMessage).toBe("");
  });

  it("reports error when enable push notifications fails", async () => {
    const pushClientStateManager = new TestPushClientStateManager({
      pushClientState: ENABLED_PUSH_CLIENT_STATE
    });
    pushClientStateManager.setShouldFailEnable(true);
    const coordinator = new PushNotificationToolbarActionCoordinator({
      pushClientStateManager,
      unsupportedPushClientState: UNSUPPORTED_PUSH_CLIENT_STATE
    });
    const enablingStates: boolean[] = [];
    let observedErrorMessage = "";

    await coordinator.enablePushNotificationsFromToolbar({
      onSetEnablingPushNotifications: (isEnabling) => {
        enablingStates.push(isEnabling);
      },
      onPushClientStateRead: () => {},
      onSetErrorMessage: (errorMessage) => {
        observedErrorMessage = errorMessage;
      }
    });

    expect(pushClientStateManager.getEnableCallCount()).toBe(1);
    expect(pushClientStateManager.getReadCallCount()).toBe(0);
    expect(enablingStates).toEqual([true, false]);
    expect(observedErrorMessage).toContain("push.enable");
  });
});

import type { PushClientState } from "@/SharedUtilities/Push";
import { PushClientStateManager } from "../DataAccess/PushClientStateManager";

interface PushNotificationToolbarActionCoordinatorDependencies {
  pushClientStateManager: PushClientStateManager;
  unsupportedPushClientState: PushClientState;
}

export interface RefreshPushClientStateInput {
  onPushClientStateRead: (state: PushClientState) => void;
}

export interface EnablePushNotificationsFromToolbarInput {
  onSetEnablingPushNotifications: (isEnabling: boolean) => void;
  onPushClientStateRead: (state: PushClientState) => void;
  onSetErrorMessage: (errorMessage: string) => void;
}

export class PushNotificationToolbarActionCoordinator {
  private readonly pushClientStateManager: PushClientStateManager;
  private readonly unsupportedPushClientState: PushClientState;

  public constructor(dependencies: PushNotificationToolbarActionCoordinatorDependencies) {
    this.pushClientStateManager = dependencies.pushClientStateManager;
    this.unsupportedPushClientState = dependencies.unsupportedPushClientState;
  }

  public async refreshPushClientState(input: RefreshPushClientStateInput): Promise<void> {
    try {
      const nextPushClientState = await this.pushClientStateManager.readPushClientState();
      input.onPushClientStateRead(nextPushClientState);
    } catch {
      input.onPushClientStateRead(this.unsupportedPushClientState);
    }
  }

  public async enablePushNotificationsFromToolbar(
    input: EnablePushNotificationsFromToolbarInput
  ): Promise<void> {
    input.onSetEnablingPushNotifications(true);
    try {
      await this.pushClientStateManager.enablePrivateModePushNotifications();
      await this.refreshPushClientState({
        onPushClientStateRead: input.onPushClientStateRead
      });
    } catch (error) {
      input.onSetErrorMessage(`push.enable: ${String(error)}`);
    } finally {
      input.onSetEnablingPushNotifications(false);
    }
  }
}

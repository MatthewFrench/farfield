import {
  enablePushNotifications,
  getPushClientState,
  type PushClientState
} from "@/SharedUtilities/Push";

export class PushClientStateManager {
  public async readPushClientState(): Promise<PushClientState> {
    return getPushClientState();
  }

  public async enablePrivateModePushNotifications(): Promise<void> {
    await enablePushNotifications({
      privateMode: true
    });
  }
}

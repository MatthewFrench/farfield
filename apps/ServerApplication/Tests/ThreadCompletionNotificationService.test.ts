import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { NtfyNotifier } from "../Source/Modules/PushNotifications/NtfyNotifier.js";
import { PushSendStore } from "../Source/Modules/PushNotifications/PushSendStore.js";
import { PushService } from "../Source/Modules/PushNotifications/PushService.js";
import { PushStore } from "../Source/Modules/PushNotifications/PushStore.js";
import { ThreadCompletionNotificationService } from "../Source/Modules/Threads/ThreadCompletionNotificationService.js";

const temporaryDirectoryPaths: string[] = [];

function createTemporaryDirectory(): string {
  const temporaryDirectoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "farfield-completion-service-"));
  temporaryDirectoryPaths.push(temporaryDirectoryPath);
  return temporaryDirectoryPath;
}

afterEach(() => {
  for (const temporaryDirectoryPath of temporaryDirectoryPaths.splice(0)) {
    if (fs.existsSync(temporaryDirectoryPath)) {
      fs.rmSync(temporaryDirectoryPath, { recursive: true, force: true });
    }
  }
});

describe("ThreadCompletionNotificationService", () => {
  it("does not schedule checks when ntfy and push are disabled", async () => {
    const temporaryDirectoryPath = createTemporaryDirectory();
    const pushStore = new PushStore(path.join(temporaryDirectoryPath, "push-state.json"));
    const pushSendStore = new PushSendStore(path.join(temporaryDirectoryPath, "push-send.json"));
    pushStore.load();
    pushSendStore.load();

    const pushService = new PushService({
      enabled: false,
      vapidPublicKey: "",
      vapidPrivateKey: "",
      vapidSubject: ""
    });
    const ntfyNotifier = new NtfyNotifier({
      enabled: false,
      topic: null,
      baseUrl: "https://ntfy.sh",
      bearerToken: null,
      priority: "3"
    });

    const pushSystemEvents: string[] = [];
    const service = new ThreadCompletionNotificationService({
      readCodexAdapter: () => null,
      ntfyNotifier,
      pushService,
      pushStore,
      pushSendStore,
      pushSystem: (message) => {
        pushSystemEvents.push(message);
      }
    });

    expect(service.shouldScheduleCompletionCheck()).toBe(false);
    await service.checkAndNotifyThreadCompletion("thread_1");
    expect(pushSystemEvents).toHaveLength(0);
  });

  it("schedules checks when ntfy is enabled", async () => {
    const temporaryDirectoryPath = createTemporaryDirectory();
    const pushStore = new PushStore(path.join(temporaryDirectoryPath, "push-state.json"));
    const pushSendStore = new PushSendStore(path.join(temporaryDirectoryPath, "push-send.json"));
    pushStore.load();
    pushSendStore.load();

    const pushService = new PushService({
      enabled: false,
      vapidPublicKey: "",
      vapidPrivateKey: "",
      vapidSubject: ""
    });
    const ntfyNotifier = new NtfyNotifier({
      enabled: true,
      topic: "farfield-tests",
      baseUrl: "https://ntfy.sh",
      bearerToken: null,
      priority: "3"
    });

    const service = new ThreadCompletionNotificationService({
      readCodexAdapter: () => null,
      ntfyNotifier,
      pushService,
      pushStore,
      pushSendStore,
      pushSystem: () => {}
    });

    expect(service.shouldScheduleCompletionCheck()).toBe(true);
    await service.checkAndNotifyThreadCompletion("thread_1");
  });
});

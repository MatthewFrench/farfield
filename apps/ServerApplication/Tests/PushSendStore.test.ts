import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PushSendStore } from "../Source/Modules/PushNotifications/PushSendStore.js";

const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    if (fs.existsSync(directory)) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
});

function createStoreWithTempPath(): { store: PushSendStore; filePath: string } {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "farfield-push-send-store-"));
  tempDirectories.push(directory);
  const filePath = path.join(directory, "push-sends.json");
  const store = new PushSendStore(filePath);
  return { store, filePath };
}

describe("PushSendStore", () => {
  it("loads default empty state when file does not exist", () => {
    const { store } = createStoreWithTempPath();
    store.load();
    expect(store.getLatest()).toBeNull();
  });

  it("persists and reloads latest send", () => {
    const { store, filePath } = createStoreWithTempPath();
    store.load();
    store.setLatest({
      notificationId: "notif_send_1",
      threadId: "thread_1",
      turnId: "turn_1",
      sentAt: "2026-02-18T00:00:00.000Z",
      attempted: 2,
      delivered: 1,
      failures: 1,
    });

    const reloaded = new PushSendStore(filePath);
    reloaded.load();
    expect(reloaded.getLatest()).toEqual({
      notificationId: "notif_send_1",
      threadId: "thread_1",
      turnId: "turn_1",
      sentAt: "2026-02-18T00:00:00.000Z",
      attempted: 2,
      delivered: 1,
      failures: 1,
    });
  });

  it("returns defensive copies from latest send reads", () => {
    const { store } = createStoreWithTempPath();
    store.load();
    store.setLatest({
      notificationId: "notif_send_2",
      threadId: "thread_2",
      turnId: "turn_2",
      sentAt: "2026-02-19T00:00:00.000Z",
      attempted: 1,
      delivered: 1,
      failures: 0,
    });

    const firstRead = store.getLatest();
    if (!firstRead) {
      throw new Error("Expected latest send summary");
    }
    firstRead.notificationId = "mutated";

    expect(store.getLatest()).toEqual({
      notificationId: "notif_send_2",
      threadId: "thread_2",
      turnId: "turn_2",
      sentAt: "2026-02-19T00:00:00.000Z",
      attempted: 1,
      delivered: 1,
      failures: 0,
    });
  });
});

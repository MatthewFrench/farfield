import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PushReceiptStore } from "../Source/Modules/PushNotifications/PushReceiptStore.js";

const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    if (fs.existsSync(directory)) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
});

function createStoreWithTempPath(
  maxReceipts = 10,
  maxReceiptAgeMs = 7 * 24 * 60 * 60 * 1_000
): { store: PushReceiptStore; filePath: string } {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "farfield-push-receipts-"));
  tempDirectories.push(directory);
  const filePath = path.join(directory, "push-receipts.json");
  const store = new PushReceiptStore(filePath, maxReceipts, maxReceiptAgeMs);
  return { store, filePath };
}

describe("PushReceiptStore", () => {
  it("loads default empty state when file does not exist", () => {
    const { store } = createStoreWithTempPath();
    store.load();
    expect(store.getCount()).toBe(0);
    expect(store.getLatest()).toBeNull();
  });

  it("persists and reloads receipts", () => {
    const createdAt = new Date(Date.now() - 1_000).toISOString();
    const { store, filePath } = createStoreWithTempPath();
    store.load();
    store.add({
      notificationId: "notif_1",
      event: "shown",
      url: "/threads/thread_1",
      threadId: "thread_1",
      turnId: "turn_1",
      message: null,
      createdAt
    });

    const reloaded = new PushReceiptStore(filePath, 10, 7 * 24 * 60 * 60 * 1_000);
    reloaded.load();

    expect(reloaded.getCount()).toBe(1);
    expect(reloaded.getLatest()).toEqual({
      notificationId: "notif_1",
      event: "shown",
      url: "/threads/thread_1",
      threadId: "thread_1",
      turnId: "turn_1",
      message: null,
      createdAt
    });
  });

  it("enforces max receipt retention", () => {
    const baseTimestampMs = Date.now();
    const { store } = createStoreWithTempPath(2);
    store.load();
    store.add({
      notificationId: "notif_1",
      event: "shown",
      url: "/threads/thread_1",
      threadId: "thread_1",
      turnId: "turn_1",
      message: null,
      createdAt: new Date(baseTimestampMs - 2_000).toISOString()
    });
    store.add({
      notificationId: "notif_2",
      event: "clicked",
      url: "/threads/thread_1",
      threadId: "thread_1",
      turnId: "turn_1",
      message: null,
      createdAt: new Date(baseTimestampMs - 1_000).toISOString()
    });
    store.add({
      notificationId: "notif_3",
      event: "shown",
      url: "/threads/thread_2",
      threadId: "thread_2",
      turnId: "turn_2",
      message: null,
      createdAt: new Date(baseTimestampMs).toISOString()
    });

    expect(store.getCount()).toBe(2);
    expect(store.getLatest()?.url).toBe("/threads/thread_2");
  });

  it("enforces max receipt age retention", () => {
    const maxAgeMs = 30_000;
    const now = Date.now();
    const staleCreatedAt = new Date(now - maxAgeMs - 1_000).toISOString();
    const freshCreatedAt = new Date(now - 1_000).toISOString();
    const { store } = createStoreWithTempPath(10, maxAgeMs);
    store.load();
    store.add({
      notificationId: "notif_stale",
      event: "shown",
      url: "/threads/thread_stale",
      threadId: "thread_stale",
      turnId: "turn_stale",
      message: null,
      createdAt: staleCreatedAt
    });
    store.add({
      notificationId: "notif_fresh",
      event: "shown",
      url: "/threads/thread_fresh",
      threadId: "thread_fresh",
      turnId: "turn_fresh",
      message: null,
      createdAt: freshCreatedAt
    });

    expect(store.getCount()).toBe(1);
    expect(store.getLatest()?.notificationId).toBe("notif_fresh");
  });
});

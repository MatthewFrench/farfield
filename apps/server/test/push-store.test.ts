import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PushStore } from "../src/push-store.js";

const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    if (fs.existsSync(directory)) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
});

function createStoreWithTempPath(): { store: PushStore; filePath: string } {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "farfield-push-store-"));
  tempDirectories.push(directory);
  const filePath = path.join(directory, "push-state.json");
  const store = new PushStore(filePath);
  return { store, filePath };
}

describe("PushStore", () => {
  it("loads default empty state when file does not exist", () => {
    const { store } = createStoreWithTempPath();
    store.load();
    expect(store.getSubscriptionCount()).toBe(0);
    expect(store.listCompletionWatermarks()).toEqual([]);
  });

  it("persists subscriptions and completion watermarks", () => {
    const { store, filePath } = createStoreWithTempPath();
    store.load();
    const saved = store.upsertSubscription(
      {
        endpoint: "https://example.push.service/subscription-id",
        keys: {
          p256dh: "BElidedKeyMaterial_123",
          auth: "CAuthValue_456"
        }
      },
      {
        privateMode: true
      }
    );
    store.setCompletionWatermark("thread_1", "thread_1:turn_1:item_1");

    const reloaded = new PushStore(filePath);
    reloaded.load();

    expect(reloaded.getSubscriptionCount()).toBe(1);
    expect(reloaded.listSubscriptions()[0]?.id).toBe(saved.id);
    expect(reloaded.getCompletionWatermark("thread_1")).toBe("thread_1:turn_1:item_1");
  });

  it("removes subscription by endpoint", () => {
    const { store } = createStoreWithTempPath();
    store.load();
    store.upsertSubscription(
      {
        endpoint: "https://example.push.service/subscription-id",
        keys: {
          p256dh: "BElidedKeyMaterial_123",
          auth: "CAuthValue_456"
        }
      },
      {
        privateMode: true
      }
    );

    const removed = store.removeSubscriptionByEndpoint(
      "https://example.push.service/subscription-id"
    );
    expect(removed).toBe(true);
    expect(store.getSubscriptionCount()).toBe(0);
  });
});


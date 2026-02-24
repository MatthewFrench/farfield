import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PushPreferenceStore } from "../Source/Features/PushNotifications/DataAccess/PushPreferenceStore";

const PUSH_AUTO_HEAL_STORAGE_KEY = "test.push.auto-heal.preference";
const originalLocalStorage = window.localStorage;

function createStorageMock(): Storage {
  const storageValues = new Map<string, string>();

  return {
    get length() {
      return storageValues.size;
    },
    clear() {
      storageValues.clear();
    },
    getItem(key: string): string | null {
      const value = storageValues.get(key);
      return value === undefined ? null : value;
    },
    key(index: number): string | null {
      return Array.from(storageValues.keys())[index] ?? null;
    },
    removeItem(key: string): void {
      storageValues.delete(key);
    },
    setItem(key: string, value: string): void {
      storageValues.set(key, value);
    }
  };
}

describe("PushPreferenceStore", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: createStorageMock()
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: originalLocalStorage
    });
  });

  it("returns false when no preference is stored", () => {
    const store = new PushPreferenceStore(PUSH_AUTO_HEAL_STORAGE_KEY);

    const enabled = store.readAutoHealPreferenceEnabled();

    expect(enabled).toBe(false);
  });

  it("persists and reads auto-heal preference", () => {
    const store = new PushPreferenceStore(PUSH_AUTO_HEAL_STORAGE_KEY);
    store.writeAutoHealPreferenceEnabled(true);

    const enabled = store.readAutoHealPreferenceEnabled();

    expect(enabled).toBe(true);
  });

  it("throws when stored auto-heal value is invalid", () => {
    const store = new PushPreferenceStore(PUSH_AUTO_HEAL_STORAGE_KEY);
    window.localStorage.setItem(PUSH_AUTO_HEAL_STORAGE_KEY, "enabled");

    expect(() => store.readAutoHealPreferenceEnabled()).toThrowError(
      `Push auto-heal preference at key "${PUSH_AUTO_HEAL_STORAGE_KEY}" is invalid. Expected "true" or "false".`
    );
  });
});

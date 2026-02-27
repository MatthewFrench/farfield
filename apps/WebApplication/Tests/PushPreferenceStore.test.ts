import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PushPreferenceStore } from "../Source/Features/PushNotifications/DataAccess/PushPreferenceStore";

const PUSH_AUTO_HEAL_STORAGE_KEY = "test.push.auto-heal.preference";
const PUSH_AUTO_HEAL_ENABLED_STORAGE_VALUE = "true";
const PUSH_AUTO_HEAL_DISABLED_STORAGE_VALUE = "false";
const INVALID_PUSH_AUTO_HEAL_STORAGE_VALUE = "enabled";
const AUTO_HEAL_PREFERENCE_FIXTURES: ReadonlyArray<{
  enabled: boolean;
  storedValue: string;
}> = [
  {
    enabled: true,
    storedValue: PUSH_AUTO_HEAL_ENABLED_STORAGE_VALUE,
  },
  {
    enabled: false,
    storedValue: PUSH_AUTO_HEAL_DISABLED_STORAGE_VALUE,
  },
];
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
    },
  };
}

function createStore(): PushPreferenceStore {
  return new PushPreferenceStore(PUSH_AUTO_HEAL_STORAGE_KEY);
}

describe("PushPreferenceStore", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: createStorageMock(),
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: originalLocalStorage,
    });
  });

  it("returns false when no preference is stored", () => {
    const store = createStore();

    const enabled = store.readAutoHealPreferenceEnabled();

    expect(enabled).toBe(false);
  });

  it.each(AUTO_HEAL_PREFERENCE_FIXTURES)("reads $storedValue as auto-heal enabled = $enabled", ({
    enabled,
    storedValue,
  }) => {
    const store = createStore();
    window.localStorage.setItem(PUSH_AUTO_HEAL_STORAGE_KEY, storedValue);

    const actualEnabled = store.readAutoHealPreferenceEnabled();

    expect(actualEnabled).toBe(enabled);
  });

  it.each(
    AUTO_HEAL_PREFERENCE_FIXTURES,
  )("writes auto-heal enabled = $enabled using storage value $storedValue", ({
    enabled,
    storedValue,
  }) => {
    const store = createStore();
    store.writeAutoHealPreferenceEnabled(enabled);

    expect(window.localStorage.getItem(PUSH_AUTO_HEAL_STORAGE_KEY)).toBe(storedValue);
  });

  it("overwrites previously stored auto-heal preference", () => {
    const store = createStore();
    store.writeAutoHealPreferenceEnabled(true);
    store.writeAutoHealPreferenceEnabled(false);

    expect(window.localStorage.getItem(PUSH_AUTO_HEAL_STORAGE_KEY)).toBe(
      PUSH_AUTO_HEAL_DISABLED_STORAGE_VALUE,
    );
    expect(store.readAutoHealPreferenceEnabled()).toBe(false);
  });

  it("throws when stored auto-heal value is invalid", () => {
    const store = createStore();
    window.localStorage.setItem(PUSH_AUTO_HEAL_STORAGE_KEY, INVALID_PUSH_AUTO_HEAL_STORAGE_VALUE);

    expect(() => store.readAutoHealPreferenceEnabled()).toThrowError(
      `Push auto-heal preference at key "${PUSH_AUTO_HEAL_STORAGE_KEY}" is invalid. Expected "${PUSH_AUTO_HEAL_ENABLED_STORAGE_VALUE}" or "${PUSH_AUTO_HEAL_DISABLED_STORAGE_VALUE}".`,
    );
  });
});

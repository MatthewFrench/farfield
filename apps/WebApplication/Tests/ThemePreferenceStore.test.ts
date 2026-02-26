import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ThemePreferenceStore } from "../Source/Features/Theme/DataAccess/ThemePreferenceStore";

const THEME_STORAGE_KEY = "test.theme.preference";
const LIGHT_THEME_PREFERENCE = "light";
const DARK_THEME_PREFERENCE = "dark";
const INVALID_THEME_PREFERENCE = "ocean";
const THEME_PREFERENCE_FIXTURES: ReadonlyArray<{
  themePreference: "light" | "dark";
}> = [
  {
    themePreference: LIGHT_THEME_PREFERENCE
  },
  {
    themePreference: DARK_THEME_PREFERENCE
  }
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
    }
  };
}

function createStore(): ThemePreferenceStore {
  return new ThemePreferenceStore(THEME_STORAGE_KEY);
}

describe("ThemePreferenceStore", () => {
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

  it("returns null when no value is stored", () => {
    const store = createStore();

    const themePreference = store.readThemePreference();

    expect(themePreference).toBeNull();
  });

  it.each(THEME_PREFERENCE_FIXTURES)(
    "reads stored theme preference $themePreference",
    ({ themePreference }) => {
      const store = createStore();
      window.localStorage.setItem(THEME_STORAGE_KEY, themePreference);

      const actualThemePreference = store.readThemePreference();

      expect(actualThemePreference).toBe(themePreference);
    }
  );

  it.each(THEME_PREFERENCE_FIXTURES)(
    "writes theme preference $themePreference",
    ({ themePreference }) => {
      const store = createStore();
      store.writeThemePreference(themePreference);

      expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe(themePreference);
    }
  );

  it("overwrites previously stored theme preference", () => {
    const store = createStore();
    store.writeThemePreference(DARK_THEME_PREFERENCE);
    store.writeThemePreference(LIGHT_THEME_PREFERENCE);

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe(LIGHT_THEME_PREFERENCE);
    expect(store.readThemePreference()).toBe(LIGHT_THEME_PREFERENCE);
  });

  it("throws when stored theme value is invalid", () => {
    const store = createStore();
    window.localStorage.setItem(THEME_STORAGE_KEY, INVALID_THEME_PREFERENCE);

    expect(() => store.readThemePreference()).toThrowError(
      `Theme preference at key "${THEME_STORAGE_KEY}" is invalid. Expected "${LIGHT_THEME_PREFERENCE}" or "${DARK_THEME_PREFERENCE}".`
    );
  });
});

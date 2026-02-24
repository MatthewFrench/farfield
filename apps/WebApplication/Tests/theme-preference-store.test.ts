import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ThemePreferenceStore } from "../Source/Features/Theme/DataAccess/ThemePreferenceStore";

const THEME_STORAGE_KEY = "test.theme.preference";
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
    const store = new ThemePreferenceStore(THEME_STORAGE_KEY);

    const themePreference = store.readThemePreference();

    expect(themePreference).toBeNull();
  });

  it("reads a previously stored theme preference", () => {
    const store = new ThemePreferenceStore(THEME_STORAGE_KEY);
    store.writeThemePreference("dark");

    const themePreference = store.readThemePreference();

    expect(themePreference).toBe("dark");
  });

  it("throws when stored theme value is invalid", () => {
    const store = new ThemePreferenceStore(THEME_STORAGE_KEY);
    window.localStorage.setItem(THEME_STORAGE_KEY, "ocean");

    expect(() => store.readThemePreference()).toThrowError(
      `Theme preference at key "${THEME_STORAGE_KEY}" is invalid. Expected "light" or "dark".`
    );
  });
});

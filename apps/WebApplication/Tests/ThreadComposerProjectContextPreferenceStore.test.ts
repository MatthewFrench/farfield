import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_THREAD_COMPOSER_PROJECT_CONTEXT_STORAGE_KEY,
  ThreadComposerProjectContextPreferenceStore,
} from "../Source/Features/Threads/DataAccess/ThreadComposerProjectContextPreferenceStore";

const PROJECT_PATH = "/workspace/project-alpha";
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
      return storageValues.get(key) ?? null;
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

describe("ThreadComposerProjectContextPreferenceStore", () => {
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

  it("reads and writes the current project context", () => {
    const store = new ThreadComposerProjectContextPreferenceStore();

    expect(store.readProjectContext()).toBeNull();
    store.writeProjectContext(PROJECT_PATH);

    expect(store.readProjectContext()).toBe(PROJECT_PATH);
  });

  it("clears the stored project context", () => {
    const store = new ThreadComposerProjectContextPreferenceStore();
    store.writeProjectContext(PROJECT_PATH);

    store.clearProjectContext();

    expect(store.readProjectContext()).toBeNull();
    expect(
      window.localStorage.getItem(DEFAULT_THREAD_COMPOSER_PROJECT_CONTEXT_STORAGE_KEY),
    ).toBeNull();
  });
});

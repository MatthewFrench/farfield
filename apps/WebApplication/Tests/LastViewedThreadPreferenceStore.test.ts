import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LastViewedThreadPreferenceStore } from "../Source/Features/Threads/DataAccess/LastViewedThreadPreferenceStore";

const LAST_VIEWED_THREAD_STORAGE_KEY = "test.last-viewed-thread";
const LAST_VIEWED_THREAD_IDENTIFIER = "thread-123";
const INVALID_LAST_VIEWED_THREAD_IDENTIFIER = "   ";
const READ_OPERATION_PREFIX = "last-viewed-thread:read";
const WRITE_OPERATION_PREFIX = "last-viewed-thread:write";
const CLEAR_OPERATION_PREFIX = "last-viewed-thread:clear";
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

function createStore(): LastViewedThreadPreferenceStore {
  return new LastViewedThreadPreferenceStore(LAST_VIEWED_THREAD_STORAGE_KEY);
}

describe("LastViewedThreadPreferenceStore", () => {
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

  it("returns null when no last-viewed thread identifier is stored", () => {
    const store = createStore();

    const threadIdentifier = store.readLastViewedThreadIdentifier();

    expect(threadIdentifier).toBeNull();
  });

  it("reads a stored last-viewed thread identifier", () => {
    const store = createStore();
    window.localStorage.setItem(LAST_VIEWED_THREAD_STORAGE_KEY, LAST_VIEWED_THREAD_IDENTIFIER);

    const threadIdentifier = store.readLastViewedThreadIdentifier();

    expect(threadIdentifier).toBe(LAST_VIEWED_THREAD_IDENTIFIER);
  });

  it("writes a last-viewed thread identifier", () => {
    const store = createStore();

    store.writeLastViewedThreadIdentifier(LAST_VIEWED_THREAD_IDENTIFIER);

    expect(window.localStorage.getItem(LAST_VIEWED_THREAD_STORAGE_KEY)).toBe(
      LAST_VIEWED_THREAD_IDENTIFIER,
    );
  });

  it("throws when the stored last-viewed thread identifier is invalid", () => {
    const store = createStore();
    window.localStorage.setItem(
      LAST_VIEWED_THREAD_STORAGE_KEY,
      INVALID_LAST_VIEWED_THREAD_IDENTIFIER,
    );

    expect(() => store.readLastViewedThreadIdentifier()).toThrowError(
      `Last viewed thread identifier at key "${LAST_VIEWED_THREAD_STORAGE_KEY}" is invalid. Expected a non-empty string.`,
    );
  });

  it("clears the stored last-viewed thread identifier", () => {
    const store = createStore();
    window.localStorage.setItem(LAST_VIEWED_THREAD_STORAGE_KEY, LAST_VIEWED_THREAD_IDENTIFIER);

    store.clearLastViewedThreadIdentifier();

    expect(window.localStorage.getItem(LAST_VIEWED_THREAD_STORAGE_KEY)).toBeNull();
  });

  it("tags read errors when browser storage access fails", () => {
    const storage = createStorageMock();
    storage.getItem = () => {
      throw new Error("storage-read-failed");
    };
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: storage,
    });
    const store = createStore();

    expect(() => store.readLastViewedThreadIdentifier()).toThrowError(
      `${READ_OPERATION_PREFIX}: storage-read-failed`,
    );
  });

  it("tags write errors when browser storage writes fail", () => {
    const storage = createStorageMock();
    storage.setItem = () => {
      throw new Error("storage-write-failed");
    };
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: storage,
    });
    const store = createStore();

    expect(() => store.writeLastViewedThreadIdentifier(LAST_VIEWED_THREAD_IDENTIFIER)).toThrowError(
      `${WRITE_OPERATION_PREFIX}: storage-write-failed`,
    );
  });

  it("tags clear errors when browser storage removal fails", () => {
    const storage = createStorageMock();
    storage.removeItem = () => {
      throw new Error("storage-clear-failed");
    };
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: storage,
    });
    const store = createStore();

    expect(() => store.clearLastViewedThreadIdentifier()).toThrowError(
      `${CLEAR_OPERATION_PREFIX}: storage-clear-failed`,
    );
  });
});

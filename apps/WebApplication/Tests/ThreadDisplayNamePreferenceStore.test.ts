import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ThreadDisplayNamePreferenceStore } from "../Source/Features/Threads/DataAccess/ThreadDisplayNamePreferenceStore";

const THREAD_DISPLAY_NAME_STORAGE_KEY_PREFIX = "test.thread-display-name.preference";
const THREAD_IDENTIFIER = "thread 123/with slash";
const STORAGE_KEY = `${THREAD_DISPLAY_NAME_STORAGE_KEY_PREFIX}.${encodeURIComponent(THREAD_IDENTIFIER)}`;
const INDEX_STORAGE_KEY = `${THREAD_DISPLAY_NAME_STORAGE_KEY_PREFIX}.index`;
const THREAD_DISPLAY_NAME = "Configure Caddy for Farfield site";
const INVALID_THREAD_DISPLAY_NAME = "   ";
const READ_OPERATION_PREFIX = "thread-display-name:read";
const WRITE_OPERATION_PREFIX = "thread-display-name:write";
const CLEAR_OPERATION_PREFIX = "thread-display-name:clear";
const PRUNE_OPERATION_PREFIX = "thread-display-name:prune";
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

function createStore(maximumEntries?: number): ThreadDisplayNamePreferenceStore {
  return new ThreadDisplayNamePreferenceStore(
    THREAD_DISPLAY_NAME_STORAGE_KEY_PREFIX,
    maximumEntries,
  );
}

function readStoredIndexIdentifiers(): string[] {
  const rawIndexValue = window.localStorage.getItem(INDEX_STORAGE_KEY);
  if (rawIndexValue === null || rawIndexValue.trim().length === 0) {
    return [];
  }
  return rawIndexValue.split("\n");
}

describe("ThreadDisplayNamePreferenceStore", () => {
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

  it("returns null when no thread display name is stored", () => {
    const store = createStore();

    const threadDisplayName = store.readThreadDisplayName(THREAD_IDENTIFIER);

    expect(threadDisplayName).toBeNull();
  });

  it("reads a stored thread display name", () => {
    const store = createStore();
    window.localStorage.setItem(STORAGE_KEY, THREAD_DISPLAY_NAME);

    const threadDisplayName = store.readThreadDisplayName(THREAD_IDENTIFIER);

    expect(threadDisplayName).toBe(THREAD_DISPLAY_NAME);
  });

  it("writes a thread display name", () => {
    const store = createStore();

    store.writeThreadDisplayName(THREAD_IDENTIFIER, THREAD_DISPLAY_NAME);

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(THREAD_DISPLAY_NAME);
    expect(readStoredIndexIdentifiers()).toEqual([encodeURIComponent(THREAD_IDENTIFIER)]);
  });

  it("throws when a stored thread display name is invalid", () => {
    const store = createStore();
    window.localStorage.setItem(STORAGE_KEY, INVALID_THREAD_DISPLAY_NAME);

    expect(() => store.readThreadDisplayName(THREAD_IDENTIFIER)).toThrowError(
      `Thread display name at key "${STORAGE_KEY}" is invalid. Expected a non-empty string.`,
    );
  });

  it("clears a stored thread display name", () => {
    const store = createStore();
    window.localStorage.setItem(STORAGE_KEY, THREAD_DISPLAY_NAME);
    window.localStorage.setItem(INDEX_STORAGE_KEY, encodeURIComponent(THREAD_IDENTIFIER));

    store.clearThreadDisplayName(THREAD_IDENTIFIER);

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(INDEX_STORAGE_KEY)).toBeNull();
  });

  it("prunes display names for thread identifiers not retained", () => {
    const store = createStore();
    const removedThreadIdentifier = "thread-remove";
    const retainedThreadIdentifier = "thread-retain";
    const removedStorageKey = `${THREAD_DISPLAY_NAME_STORAGE_KEY_PREFIX}.${encodeURIComponent(removedThreadIdentifier)}`;
    const retainedStorageKey = `${THREAD_DISPLAY_NAME_STORAGE_KEY_PREFIX}.${encodeURIComponent(retainedThreadIdentifier)}`;

    store.writeThreadDisplayName(removedThreadIdentifier, "remove");
    store.writeThreadDisplayName(retainedThreadIdentifier, "retain");

    store.pruneThreadDisplayNames([retainedThreadIdentifier]);

    expect(window.localStorage.getItem(removedStorageKey)).toBeNull();
    expect(window.localStorage.getItem(retainedStorageKey)).toBe("retain");
    expect(readStoredIndexIdentifiers()).toEqual([encodeURIComponent(retainedThreadIdentifier)]);
  });

  it("evicts least-recently-updated display names when maximum entries are exceeded", () => {
    const store = createStore(2);
    const threadOneIdentifier = "thread-one";
    const threadTwoIdentifier = "thread-two";
    const threadThreeIdentifier = "thread-three";

    store.writeThreadDisplayName(threadOneIdentifier, "one");
    store.writeThreadDisplayName(threadTwoIdentifier, "two");
    store.writeThreadDisplayName(threadThreeIdentifier, "three");

    expect(store.readThreadDisplayName(threadOneIdentifier)).toBeNull();
    expect(store.readThreadDisplayName(threadTwoIdentifier)).toBe("two");
    expect(store.readThreadDisplayName(threadThreeIdentifier)).toBe("three");
    expect(readStoredIndexIdentifiers()).toEqual([
      encodeURIComponent(threadThreeIdentifier),
      encodeURIComponent(threadTwoIdentifier),
    ]);
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

    expect(() => store.readThreadDisplayName(THREAD_IDENTIFIER)).toThrowError(
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

    expect(() => store.writeThreadDisplayName(THREAD_IDENTIFIER, THREAD_DISPLAY_NAME)).toThrowError(
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

    expect(() => store.clearThreadDisplayName(THREAD_IDENTIFIER)).toThrowError(
      `${CLEAR_OPERATION_PREFIX}: storage-clear-failed`,
    );
  });

  it("tags prune errors when browser storage removal fails", () => {
    const storage = createStorageMock();
    storage.setItem(INDEX_STORAGE_KEY, encodeURIComponent("thread-prune"));
    storage.setItem(
      `${THREAD_DISPLAY_NAME_STORAGE_KEY_PREFIX}.${encodeURIComponent("thread-prune")}`,
      "prune-value",
    );
    storage.removeItem = () => {
      throw new Error("storage-prune-failed");
    };
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: storage,
    });
    const store = createStore();

    expect(() => store.pruneThreadDisplayNames([])).toThrowError(
      `${PRUNE_OPERATION_PREFIX}: storage-prune-failed`,
    );
  });
});

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ThreadDisplayNamePreferenceStore,
  type ThreadIdentifier,
} from "../Source/Features/Threads/DataAccess/ThreadDisplayNamePreferenceStore";
import type { ThreadListItem } from "../Source/Features/Threads/DomainModel/ThreadGroupTypes";
import { ThreadDisplayNameStateOwner } from "../Source/Features/Threads/StateManagement/ThreadDisplayNameStateOwner";

const THREAD_DISPLAY_NAME_STORAGE_KEY_PREFIX = "test.thread-display-name.state-owner";
const originalLocalStorage = window.localStorage;

interface ThreadFixtureInput {
  id: string;
  preview?: string;
  displayName?: string;
}

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

function buildThread(input: ThreadFixtureInput): ThreadListItem {
  return {
    id: input.id,
    preview: input.preview ?? `preview-${input.id}`,
    displayName: input.displayName,
    createdAt: 1_700_000_000,
    updatedAt: 1_700_000_001,
    agentId: "codex",
    hasUnreadTurn: null,
    isProjectRemoved: false,
  };
}

function createOwnerFixture() {
  const store = new ThreadDisplayNamePreferenceStore(THREAD_DISPLAY_NAME_STORAGE_KEY_PREFIX);
  const owner = new ThreadDisplayNameStateOwner({
    threadDisplayNamePreferenceStore: store,
  });
  return {
    store,
    owner,
  };
}

function readStoredDisplayName(
  store: ThreadDisplayNamePreferenceStore,
  threadIdentifier: ThreadIdentifier,
): string | null {
  return store.readThreadDisplayName(threadIdentifier);
}

describe("ThreadDisplayNameStateOwner", () => {
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

  it("applies persisted display names when list payload does not provide one", () => {
    const { store, owner } = createOwnerFixture();
    store.writeThreadDisplayName("thread-1", "Persisted name");

    const nextThreads = owner.applyDisplayNamesToThreadList([
      buildThread({
        id: "thread-1",
        preview: "preview one",
      }),
      buildThread({
        id: "thread-2",
        preview: "preview two",
      }),
    ]);

    expect(nextThreads[0]?.displayName).toBe("Persisted name");
    expect(nextThreads[1]?.displayName).toBeUndefined();
  });

  it("prefers server display names and writes them to persistence", () => {
    const { store, owner } = createOwnerFixture();

    const nextThreads = owner.applyDisplayNamesToThreadList([
      buildThread({
        id: "thread-1",
        preview: "preview one",
        displayName: "  Name from server  ",
      }),
    ]);

    expect(nextThreads[0]?.displayName).toBe("Name from server");
    expect(readStoredDisplayName(store, "thread-1")).toBe("Name from server");
  });

  it("returns the original thread collection reference when no label changes are required", () => {
    const { owner } = createOwnerFixture();
    const threads = [
      buildThread({
        id: "thread-1",
        preview: "preview one",
      }),
    ];

    const nextThreads = owner.applyDisplayNamesToThreadList(threads);

    expect(nextThreads).toBe(threads);
  });

  it("writes display names from mutation paths", () => {
    const { store, owner } = createOwnerFixture();

    owner.writeThreadDisplayName("thread-1", "  Configure Caddy for Farfield site  ");

    expect(readStoredDisplayName(store, "thread-1")).toBe("Configure Caddy for Farfield site");
  });

  it("rejects empty display names from mutation paths", () => {
    const { owner } = createOwnerFixture();

    expect(() => owner.writeThreadDisplayName("thread-1", "   ")).toThrowError(
      "Thread display name must contain at least one non-whitespace character.",
    );
  });

  it("ignores missing display names when applying optional updates", () => {
    const { store, owner } = createOwnerFixture();

    owner.writeThreadDisplayNameIfPresent("thread-1", null);
    owner.writeThreadDisplayNameIfPresent("thread-1", "   ");
    owner.writeThreadDisplayNameIfPresent("thread-1", "  Saved name  ");

    expect(readStoredDisplayName(store, "thread-1")).toBe("Saved name");
  });

  it("prunes persisted and cached names outside retained thread identifiers", () => {
    const { store, owner } = createOwnerFixture();
    store.writeThreadDisplayName("thread-1", "Persisted name one");
    store.writeThreadDisplayName("thread-2", "Persisted name two");

    owner.applyDisplayNamesToThreadList([
      buildThread({
        id: "thread-1",
      }),
      buildThread({
        id: "thread-2",
      }),
    ]);

    owner.pruneThreadDisplayNames(["thread-2"]);

    expect(readStoredDisplayName(store, "thread-1")).toBeNull();
    expect(readStoredDisplayName(store, "thread-2")).toBe("Persisted name two");
    const nextThreads = owner.applyDisplayNamesToThreadList([
      buildThread({
        id: "thread-1",
      }),
      buildThread({
        id: "thread-2",
      }),
    ]);
    expect(nextThreads[0]?.displayName).toBeUndefined();
    expect(nextThreads[1]?.displayName).toBe("Persisted name two");
  });
});

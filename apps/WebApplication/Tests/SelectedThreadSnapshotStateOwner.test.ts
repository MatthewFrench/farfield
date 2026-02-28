import type { IpcFrame } from "@farfield/protocol";
import { type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type ChatLiveStateResponse,
  type ChatReadThreadResponse,
  type ChatStreamEventsResponse,
} from "@/Features/Chat/DataAccess/ChatServerClient";
import { ConversationSyncSignatureBuilder } from "@/Features/Chat/DomainModel/ConversationSyncSignatureBuilder";
import { ModeSelectionStateResolver } from "@/Features/Chat/DomainModel/ModeSelectionStateResolver";
import { ReadThreadStateMerger } from "@/Features/Chat/StateManagement/ReadThreadStateMerger";
import {
  type ApplySnapshotsToStateInput,
  SelectedThreadSnapshotStateOwner,
} from "@/Features/Chat/StateManagement/SelectedThreadSnapshotStateOwner";
import { ThreadDisplayNamePreferenceStore } from "@/Features/Threads/DataAccess/ThreadDisplayNamePreferenceStore";
import { PendingThreadMaterializationCoordinator } from "@/Features/Threads/StateManagement/PendingThreadMaterializationCoordinator";
import { ThreadDisplayNameStateOwner } from "@/Features/Threads/StateManagement/ThreadDisplayNameStateOwner";

interface SnapshotOwnerHarness {
  owner: SelectedThreadSnapshotStateOwner;
  selectedThreadIdRef: MutableRefObject<string | null>;
  readStreamEvents: () => ChatStreamEventsResponse["events"];
  readPersistedThreadDisplayName: () => string | null;
}

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

function buildBroadcastEvent(method: string): IpcFrame {
  return {
    type: "broadcast",
    method,
    params: {},
  };
}

function buildConversationState(
  threadId: string,
  title?: string,
): NonNullable<ChatLiveStateResponse["conversationState"]> {
  return {
    id: threadId,
    turns: [],
    requests: [],
    title,
    updatedAt: 1_700_000_000,
    latestModel: "gpt-5.3-codex",
    latestReasoningEffort: "medium",
    latestCollaborationMode: {
      mode: "default",
      settings: {
        model: "gpt-5.3-codex",
        reasoning_effort: "medium",
        developer_instructions: null,
      },
    },
  };
}

function buildLiveStateSnapshot(threadId: string, title?: string): ChatLiveStateResponse {
  return {
    ok: true,
    threadId,
    ownerClientId: null,
    conversationState: buildConversationState(threadId, title),
    liveStateError: null,
  };
}

function buildStreamEventsSnapshot(input: {
  threadId: string;
  events: IpcFrame[];
  nextSequence: number;
  resetRequired: boolean;
}): ChatStreamEventsResponse {
  return {
    ok: true,
    threadId: input.threadId,
    ownerClientId: null,
    events: input.events,
    nextSequence: input.nextSequence,
    firstAvailableSequence: 0,
    resetRequired: input.resetRequired,
  };
}

function resolveStateUpdate<StateType>(
  previousState: StateType,
  nextState: SetStateAction<StateType>,
): StateType {
  if (typeof nextState === "function") {
    const stateUpdater = nextState as (value: StateType) => StateType;
    return stateUpdater(previousState);
  }
  return nextState;
}

function createStateSetter<StateType>(
  readState: () => StateType,
  writeState: (nextState: StateType) => void,
): Dispatch<SetStateAction<StateType>> {
  return (nextState) => {
    writeState(resolveStateUpdate(readState(), nextState));
  };
}

function createSnapshotApplyInput(input: {
  threadId: string;
  streamEventsSnapshot: ChatStreamEventsResponse;
  streamEventsSinceSequenceUsed: number | null;
}): ApplySnapshotsToStateInput {
  return {
    threadId: input.threadId,
    liveStateSnapshot: buildLiveStateSnapshot(input.threadId),
    streamEventsSnapshot: input.streamEventsSnapshot,
    streamEventsSinceSequenceUsed: input.streamEventsSinceSequenceUsed,
    readThreadSnapshot: null,
    includeTurnsUsedForRead: false,
  };
}

function createHarness(initialSelectedThreadId: string): SnapshotOwnerHarness {
  const selectedThreadIdRef: MutableRefObject<string | null> = {
    current: initialSelectedThreadId,
  };
  let liveState: ChatLiveStateResponse | null = null;
  let readThreadState: ChatReadThreadResponse | null = null;
  let streamEvents: ChatStreamEventsResponse["events"] = [];

  const threadDisplayNamePreferenceStore = new ThreadDisplayNamePreferenceStore(
    `test.selected-thread-snapshot.display-name.${initialSelectedThreadId}`,
  );

  const owner = new SelectedThreadSnapshotStateOwner({
    appDefaultModel: "gpt-5.3-codex",
    appDefaultReasoningEffort: "medium",
    selectedThreadIdRef,
    pendingThreadMaterializationCoordinator: new PendingThreadMaterializationCoordinator(),
    conversationSyncSignatureBuilder: new ConversationSyncSignatureBuilder(
      new ModeSelectionStateResolver(),
    ),
    readThreadStateMerger: new ReadThreadStateMerger(),
    threadDisplayNameStateOwner: new ThreadDisplayNameStateOwner({
      threadDisplayNamePreferenceStore,
    }),
    setLiveState: createStateSetter(
      () => liveState,
      (nextState) => {
        liveState = nextState;
      },
    ),
    setReadThreadState: createStateSetter(
      () => readThreadState,
      (nextState) => {
        readThreadState = nextState;
      },
    ),
    setStreamEvents: createStateSetter(
      () => streamEvents,
      (nextState) => {
        streamEvents = nextState;
      },
    ),
  });

  return {
    owner,
    selectedThreadIdRef,
    readStreamEvents: () => streamEvents,
    readPersistedThreadDisplayName: () =>
      threadDisplayNamePreferenceStore.readThreadDisplayName(initialSelectedThreadId),
  };
}

describe("SelectedThreadSnapshotStateOwner", () => {
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

  it("forces a full stream read cursor when switching to another thread", () => {
    const harness = createHarness("thread-1");
    harness.owner.applySnapshots(
      createSnapshotApplyInput({
        threadId: "thread-1",
        streamEventsSnapshot: buildStreamEventsSnapshot({
          threadId: "thread-1",
          events: [buildBroadcastEvent("thread-1-event-1")],
          nextSequence: 2,
          resetRequired: false,
        }),
        streamEventsSinceSequenceUsed: null,
      }),
    );
    expect(harness.owner.readStreamEventsSinceSequence("thread-1")).toBe(1);

    harness.selectedThreadIdRef.current = "thread-2";
    harness.owner.applySnapshots(
      createSnapshotApplyInput({
        threadId: "thread-2",
        streamEventsSnapshot: buildStreamEventsSnapshot({
          threadId: "thread-2",
          events: [buildBroadcastEvent("thread-2-event-1")],
          nextSequence: 3,
          resetRequired: false,
        }),
        streamEventsSinceSequenceUsed: null,
      }),
    );

    expect(harness.owner.readStreamEventsSinceSequence("thread-1")).toBeNull();
    expect(harness.owner.readStreamEventsSinceSequence("thread-2")).toBe(2);
  });

  it("keeps stream events and cursor unchanged when an incremental delta cursor mismatches", () => {
    const harness = createHarness("thread-1");
    harness.owner.applySnapshots(
      createSnapshotApplyInput({
        threadId: "thread-1",
        streamEventsSnapshot: buildStreamEventsSnapshot({
          threadId: "thread-1",
          events: [buildBroadcastEvent("event-1")],
          nextSequence: 2,
          resetRequired: false,
        }),
        streamEventsSinceSequenceUsed: null,
      }),
    );

    harness.owner.applySnapshots(
      createSnapshotApplyInput({
        threadId: "thread-1",
        streamEventsSnapshot: buildStreamEventsSnapshot({
          threadId: "thread-1",
          events: [buildBroadcastEvent("event-late")],
          nextSequence: 3,
          resetRequired: false,
        }),
        streamEventsSinceSequenceUsed: 99,
      }),
    );

    expect(harness.readStreamEvents()).toEqual([buildBroadcastEvent("event-1")]);
    expect(harness.owner.readStreamEventsSinceSequence("thread-1")).toBe(1);
  });

  it("writes thread display name from snapshot titles", () => {
    const harness = createHarness("thread-1");

    harness.owner.applySnapshots({
      threadId: "thread-1",
      liveStateSnapshot: buildLiveStateSnapshot(
        "thread-1",
        "  Configure Caddy for Farfield site  ",
      ),
      streamEventsSnapshot: buildStreamEventsSnapshot({
        threadId: "thread-1",
        events: [],
        nextSequence: 0,
        resetRequired: false,
      }),
      streamEventsSinceSequenceUsed: null,
      readThreadSnapshot: null,
      includeTurnsUsedForRead: false,
    });

    expect(harness.readPersistedThreadDisplayName()).toBe("Configure Caddy for Farfield site");
  });
});

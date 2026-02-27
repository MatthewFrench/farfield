import type { IpcFrame } from "@farfield/protocol";
import { cleanup, render, waitFor } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import {
  type ChatLiveStateResponse,
  type ChatReadThreadResponse,
  ChatServerClient,
  type ChatStreamEventsResponse,
} from "@/Features/Chat/DataAccess/ChatServerClient";
import { ConversationSyncSignatureBuilder } from "@/Features/Chat/DomainModel/ConversationSyncSignatureBuilder";
import { ModeSelectionStateResolver } from "@/Features/Chat/DomainModel/ModeSelectionStateResolver";
import { ReadThreadStateMerger } from "@/Features/Chat/StateManagement/ReadThreadStateMerger";
import {
  SelectedThreadDataRefreshCoordinator,
  type SelectedThreadDataRefreshInput,
  type SelectedThreadDataRefreshResult,
} from "@/Features/Chat/StateManagement/SelectedThreadDataRefreshCoordinator";
import { SelectedThreadRefreshConcurrencyCoordinator } from "@/Features/Chat/StateManagement/SelectedThreadRefreshConcurrencyCoordinator";
import {
  type SelectedThreadLoaders,
  useSelectedThreadLoaders,
} from "@/Features/Chat/StateManagement/UseSelectedThreadLoaders";
import type { ThreadListItem } from "@/Features/Threads/DomainModel/ThreadGroupTypes";
import { PendingThreadMaterializationCoordinator } from "@/Features/Threads/StateManagement/PendingThreadMaterializationCoordinator";
import type { AgentId } from "@/Shared/Contracts/ApiContracts";

interface SelectedThreadLoadersHarnessSnapshot {
  loaders: SelectedThreadLoaders;
  liveState: ChatLiveStateResponse | null;
  readThreadState: ChatReadThreadResponse | null;
  streamEvents: ChatStreamEventsResponse["events"];
}

interface SelectedThreadLoadersHarnessProperties {
  threads: ThreadListItem[];
  selectedAgentId: AgentId;
  appDefaultModel: string;
  appDefaultReasoningEffort: string;
  selectedThreadIdRef: { current: string | null };
  pendingThreadMaterializationCoordinator: PendingThreadMaterializationCoordinator;
  conversationSyncSignatureBuilder: ConversationSyncSignatureBuilder;
  selectedThreadDataRefreshCoordinator: SelectedThreadDataRefreshCoordinator;
  selectedThreadRefreshConcurrencyCoordinator: SelectedThreadRefreshConcurrencyCoordinator;
  readThreadStateMerger: ReadThreadStateMerger;
  chatServerClient: ChatServerClient;
  onSnapshot: (snapshot: SelectedThreadLoadersHarnessSnapshot) => void;
}

class TestSelectedThreadDataRefreshCoordinator extends SelectedThreadDataRefreshCoordinator {
  public readonly readSnapshotCalls: SelectedThreadDataRefreshInput[];
  private readonly queuedResults: SelectedThreadDataRefreshResult[];

  public constructor(initialResults: SelectedThreadDataRefreshResult[]) {
    super();
    this.readSnapshotCalls = [];
    this.queuedResults = [...initialResults];
  }

  public override async readSnapshot(
    input: SelectedThreadDataRefreshInput,
  ): Promise<SelectedThreadDataRefreshResult> {
    this.readSnapshotCalls.push(input);
    const nextResult = this.queuedResults.shift();
    if (!nextResult) {
      throw new Error("Expected a queued snapshot result");
    }
    return nextResult;
  }
}

function SelectedThreadLoadersHarness(
  properties: SelectedThreadLoadersHarnessProperties,
): React.JSX.Element {
  const [liveState, setLiveState] = useState<ChatLiveStateResponse | null>(null);
  const [readThreadState, setReadThreadState] = useState<ChatReadThreadResponse | null>(null);
  const [streamEvents, setStreamEvents] = useState<ChatStreamEventsResponse["events"]>([]);

  const loaders = useSelectedThreadLoaders({
    threads: properties.threads,
    selectedAgentId: properties.selectedAgentId,
    agentsById: {},
    appDefaultModel: properties.appDefaultModel,
    appDefaultReasoningEffort: properties.appDefaultReasoningEffort,
    selectedThreadIdRef: properties.selectedThreadIdRef,
    pendingThreadMaterializationCoordinator: properties.pendingThreadMaterializationCoordinator,
    conversationSyncSignatureBuilder: properties.conversationSyncSignatureBuilder,
    selectedThreadDataRefreshCoordinator: properties.selectedThreadDataRefreshCoordinator,
    selectedThreadRefreshConcurrencyCoordinator:
      properties.selectedThreadRefreshConcurrencyCoordinator,
    readThreadStateMerger: properties.readThreadStateMerger,
    chatServerClient: properties.chatServerClient,
    setLiveState,
    setReadThreadState,
    setStreamEvents,
  });

  useEffect(() => {
    properties.onSnapshot({
      loaders,
      liveState,
      readThreadState,
      streamEvents,
    });
  }, [liveState, loaders, properties, readThreadState, streamEvents]);

  return <></>;
}

function buildThreadListItem(threadId: string): ThreadListItem {
  return {
    id: threadId,
    preview: "",
    createdAt: 1_700_000_000,
    updatedAt: 1_700_000_000,
    agentId: "codex",
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
  turnIds: string[],
): NonNullable<ChatLiveStateResponse["conversationState"]> {
  return {
    id: threadId,
    turns: turnIds.map((turnId) => ({
      id: turnId,
      status: "completed",
      items: [],
    })),
    requests: [],
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

function buildLiveStateSnapshot(threadId: string, turnIds: string[]): ChatLiveStateResponse {
  return {
    ok: true,
    threadId,
    ownerClientId: null,
    conversationState: buildConversationState(threadId, turnIds),
    liveStateError: null,
  };
}

function buildReadThreadSnapshot(threadId: string, turnIds: string[]): ChatReadThreadResponse {
  return {
    ok: true,
    thread: buildConversationState(threadId, turnIds),
    agentId: "codex",
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

function readLoadersSnapshot(snapshotReference: {
  current: SelectedThreadLoadersHarnessSnapshot | null;
}): SelectedThreadLoadersHarnessSnapshot {
  const snapshot = snapshotReference.current;
  if (!snapshot) {
    throw new Error("Expected loader snapshot to be captured");
  }
  return snapshot;
}

describe("useSelectedThreadLoaders", () => {
  afterEach(() => {
    cleanup();
  });

  it("appends cursor-scoped stream deltas and advances the next read cursor", async () => {
    const pendingThreadMaterializationCoordinator = new PendingThreadMaterializationCoordinator();
    pendingThreadMaterializationCoordinator.markPending("thread-1");
    const selectedThreadDataRefreshCoordinator = new TestSelectedThreadDataRefreshCoordinator([
      {
        liveStateSnapshot: buildLiveStateSnapshot("thread-1", ["live-turn-1"]),
        streamEventsSnapshot: buildStreamEventsSnapshot({
          threadId: "thread-1",
          events: [buildBroadcastEvent("event-1")],
          nextSequence: 11,
          resetRequired: false,
        }),
        streamEventsSinceSequenceUsed: null,
        readThreadSnapshot: buildReadThreadSnapshot("thread-1", ["read-turn-1"]),
        includeTurnsUsedForRead: true,
        containsAnyTurns: true,
      },
      {
        liveStateSnapshot: buildLiveStateSnapshot("thread-1", ["live-turn-1"]),
        streamEventsSnapshot: buildStreamEventsSnapshot({
          threadId: "thread-1",
          events: [buildBroadcastEvent("event-2")],
          nextSequence: 12,
          resetRequired: false,
        }),
        streamEventsSinceSequenceUsed: 10,
        readThreadSnapshot: null,
        includeTurnsUsedForRead: false,
        containsAnyTurns: true,
      },
    ]);
    const selectedThreadIdRef = { current: "thread-1" };
    const modeSelectionStateResolver = new ModeSelectionStateResolver();
    const conversationSyncSignatureBuilder = new ConversationSyncSignatureBuilder(
      modeSelectionStateResolver,
    );
    const selectedThreadRefreshConcurrencyCoordinator =
      new SelectedThreadRefreshConcurrencyCoordinator();
    const snapshotReference: {
      current: SelectedThreadLoadersHarnessSnapshot | null;
    } = {
      current: null,
    };

    render(
      <SelectedThreadLoadersHarness
        threads={[buildThreadListItem("thread-1")]}
        selectedAgentId="codex"
        appDefaultModel="gpt-5.3-codex"
        appDefaultReasoningEffort="medium"
        selectedThreadIdRef={selectedThreadIdRef}
        pendingThreadMaterializationCoordinator={pendingThreadMaterializationCoordinator}
        conversationSyncSignatureBuilder={conversationSyncSignatureBuilder}
        selectedThreadDataRefreshCoordinator={selectedThreadDataRefreshCoordinator}
        selectedThreadRefreshConcurrencyCoordinator={selectedThreadRefreshConcurrencyCoordinator}
        readThreadStateMerger={new ReadThreadStateMerger()}
        chatServerClient={new ChatServerClient()}
        onSnapshot={(snapshot) => {
          snapshotReference.current = snapshot;
        }}
      />,
    );

    await waitFor(() => {
      expect(snapshotReference.current).not.toBeNull();
    });
    const loadersSnapshot = readLoadersSnapshot(snapshotReference);

    await loadersSnapshot.loaders.loadSelectedThread("thread-1", {
      includeTurns: true,
      includeReadThread: true,
    });

    await waitFor(() => {
      expect(snapshotReference.current?.streamEvents.length).toBe(1);
      expect(snapshotReference.current?.streamEvents[0]).toEqual(buildBroadcastEvent("event-1"));
    });
    expect(pendingThreadMaterializationCoordinator.isPending("thread-1")).toBe(false);

    await loadersSnapshot.loaders.loadSelectedThread("thread-1", {
      includeTurns: false,
      includeReadThread: false,
    });

    await waitFor(() => {
      expect(snapshotReference.current?.streamEvents.length).toBe(2);
      expect(snapshotReference.current?.streamEvents[1]).toEqual(buildBroadcastEvent("event-2"));
    });
    expect(
      selectedThreadDataRefreshCoordinator.readSnapshotCalls[1]?.streamEventsSinceSequence,
    ).toBe(10);
    expect(selectedThreadDataRefreshCoordinator.readSnapshotCalls[1]?.includeReadThread).toBe(
      false,
    );
  });

  it("defaults includeReadThread to true when no options are provided", async () => {
    const selectedThreadDataRefreshCoordinator = new TestSelectedThreadDataRefreshCoordinator([
      {
        liveStateSnapshot: buildLiveStateSnapshot("thread-1", ["live-turn-1"]),
        streamEventsSnapshot: buildStreamEventsSnapshot({
          threadId: "thread-1",
          events: [],
          nextSequence: 1,
          resetRequired: false,
        }),
        streamEventsSinceSequenceUsed: null,
        readThreadSnapshot: buildReadThreadSnapshot("thread-1", ["read-turn-1"]),
        includeTurnsUsedForRead: true,
        containsAnyTurns: true,
      },
    ]);
    const selectedThreadIdRef = { current: "thread-1" };
    const modeSelectionStateResolver = new ModeSelectionStateResolver();
    const conversationSyncSignatureBuilder = new ConversationSyncSignatureBuilder(
      modeSelectionStateResolver,
    );
    const selectedThreadRefreshConcurrencyCoordinator =
      new SelectedThreadRefreshConcurrencyCoordinator();
    const snapshotReference: {
      current: SelectedThreadLoadersHarnessSnapshot | null;
    } = {
      current: null,
    };

    render(
      <SelectedThreadLoadersHarness
        threads={[buildThreadListItem("thread-1")]}
        selectedAgentId="codex"
        appDefaultModel="gpt-5.3-codex"
        appDefaultReasoningEffort="medium"
        selectedThreadIdRef={selectedThreadIdRef}
        pendingThreadMaterializationCoordinator={new PendingThreadMaterializationCoordinator()}
        conversationSyncSignatureBuilder={conversationSyncSignatureBuilder}
        selectedThreadDataRefreshCoordinator={selectedThreadDataRefreshCoordinator}
        selectedThreadRefreshConcurrencyCoordinator={selectedThreadRefreshConcurrencyCoordinator}
        readThreadStateMerger={new ReadThreadStateMerger()}
        chatServerClient={new ChatServerClient()}
        onSnapshot={(snapshot) => {
          snapshotReference.current = snapshot;
        }}
      />,
    );

    await waitFor(() => {
      expect(snapshotReference.current).not.toBeNull();
    });
    const loadersSnapshot = readLoadersSnapshot(snapshotReference);

    await loadersSnapshot.loaders.loadSelectedThread("thread-1");

    await waitFor(() => {
      expect(selectedThreadDataRefreshCoordinator.readSnapshotCalls.length).toBe(1);
    });
    expect(selectedThreadDataRefreshCoordinator.readSnapshotCalls[0]?.includeReadThread).toBe(true);
  });

  it("applies thread deltas only for the selected thread and resets on resetRequired snapshots", async () => {
    const selectedThreadDataRefreshCoordinator = new TestSelectedThreadDataRefreshCoordinator([]);
    const selectedThreadIdRef = { current: "thread-1" };
    const modeSelectionStateResolver = new ModeSelectionStateResolver();
    const conversationSyncSignatureBuilder = new ConversationSyncSignatureBuilder(
      modeSelectionStateResolver,
    );
    const selectedThreadRefreshConcurrencyCoordinator =
      new SelectedThreadRefreshConcurrencyCoordinator();
    const snapshotReference: {
      current: SelectedThreadLoadersHarnessSnapshot | null;
    } = {
      current: null,
    };

    render(
      <SelectedThreadLoadersHarness
        threads={[buildThreadListItem("thread-1")]}
        selectedAgentId="codex"
        appDefaultModel="gpt-5.3-codex"
        appDefaultReasoningEffort="medium"
        selectedThreadIdRef={selectedThreadIdRef}
        pendingThreadMaterializationCoordinator={new PendingThreadMaterializationCoordinator()}
        conversationSyncSignatureBuilder={conversationSyncSignatureBuilder}
        selectedThreadDataRefreshCoordinator={selectedThreadDataRefreshCoordinator}
        selectedThreadRefreshConcurrencyCoordinator={selectedThreadRefreshConcurrencyCoordinator}
        readThreadStateMerger={new ReadThreadStateMerger()}
        chatServerClient={new ChatServerClient()}
        onSnapshot={(snapshot) => {
          snapshotReference.current = snapshot;
        }}
      />,
    );

    await waitFor(() => {
      expect(snapshotReference.current).not.toBeNull();
    });
    const loadersSnapshot = readLoadersSnapshot(snapshotReference);

    loadersSnapshot.loaders.applySelectedThreadStreamDelta({
      threadId: "thread-1",
      liveStateSnapshot: buildLiveStateSnapshot("thread-1", ["live-turn-1"]),
      streamEventsSnapshot: buildStreamEventsSnapshot({
        threadId: "thread-1",
        events: [buildBroadcastEvent("selected-event")],
        nextSequence: 1,
        resetRequired: false,
      }),
      streamEventsSinceSequenceUsed: null,
    });

    await waitFor(() => {
      expect(snapshotReference.current?.streamEvents).toEqual([
        buildBroadcastEvent("selected-event"),
      ]);
    });

    loadersSnapshot.loaders.applySelectedThreadStreamDelta({
      threadId: "thread-2",
      liveStateSnapshot: buildLiveStateSnapshot("thread-2", ["live-turn-2"]),
      streamEventsSnapshot: buildStreamEventsSnapshot({
        threadId: "thread-2",
        events: [buildBroadcastEvent("unselected-event")],
        nextSequence: 1,
        resetRequired: false,
      }),
      streamEventsSinceSequenceUsed: null,
    });

    await waitFor(() => {
      expect(snapshotReference.current?.streamEvents).toEqual([
        buildBroadcastEvent("selected-event"),
      ]);
    });

    loadersSnapshot.loaders.applySelectedThreadStreamDelta({
      threadId: "thread-1",
      liveStateSnapshot: buildLiveStateSnapshot("thread-1", ["live-turn-3"]),
      streamEventsSnapshot: buildStreamEventsSnapshot({
        threadId: "thread-1",
        events: [buildBroadcastEvent("reset-event")],
        nextSequence: 2,
        resetRequired: true,
      }),
      streamEventsSinceSequenceUsed: null,
    });

    await waitFor(() => {
      expect(snapshotReference.current?.streamEvents).toEqual([buildBroadcastEvent("reset-event")]);
    });
  });

  it("retains only the newest 400 stream events when appending cursor-based deltas", async () => {
    const selectedThreadDataRefreshCoordinator = new TestSelectedThreadDataRefreshCoordinator([]);
    const selectedThreadIdRef = { current: "thread-1" };
    const modeSelectionStateResolver = new ModeSelectionStateResolver();
    const conversationSyncSignatureBuilder = new ConversationSyncSignatureBuilder(
      modeSelectionStateResolver,
    );
    const selectedThreadRefreshConcurrencyCoordinator =
      new SelectedThreadRefreshConcurrencyCoordinator();
    const snapshotReference: {
      current: SelectedThreadLoadersHarnessSnapshot | null;
    } = {
      current: null,
    };

    render(
      <SelectedThreadLoadersHarness
        threads={[buildThreadListItem("thread-1")]}
        selectedAgentId="codex"
        appDefaultModel="gpt-5.3-codex"
        appDefaultReasoningEffort="medium"
        selectedThreadIdRef={selectedThreadIdRef}
        pendingThreadMaterializationCoordinator={new PendingThreadMaterializationCoordinator()}
        conversationSyncSignatureBuilder={conversationSyncSignatureBuilder}
        selectedThreadDataRefreshCoordinator={selectedThreadDataRefreshCoordinator}
        selectedThreadRefreshConcurrencyCoordinator={selectedThreadRefreshConcurrencyCoordinator}
        readThreadStateMerger={new ReadThreadStateMerger()}
        chatServerClient={new ChatServerClient()}
        onSnapshot={(snapshot) => {
          snapshotReference.current = snapshot;
        }}
      />,
    );

    await waitFor(() => {
      expect(snapshotReference.current).not.toBeNull();
    });
    const loadersSnapshot = readLoadersSnapshot(snapshotReference);

    const initialEvents = Array.from({ length: 400 }, (_value, index) =>
      buildBroadcastEvent(`event-${String(index)}`),
    );
    const appendedEvent = buildBroadcastEvent("event-400");

    loadersSnapshot.loaders.applySelectedThreadStreamDelta({
      threadId: "thread-1",
      liveStateSnapshot: buildLiveStateSnapshot("thread-1", ["live-turn-1"]),
      streamEventsSnapshot: buildStreamEventsSnapshot({
        threadId: "thread-1",
        events: initialEvents,
        nextSequence: 400,
        resetRequired: false,
      }),
      streamEventsSinceSequenceUsed: null,
    });

    await waitFor(() => {
      expect(snapshotReference.current?.streamEvents.length).toBe(400);
    });

    loadersSnapshot.loaders.applySelectedThreadStreamDelta({
      threadId: "thread-1",
      liveStateSnapshot: buildLiveStateSnapshot("thread-1", ["live-turn-1"]),
      streamEventsSnapshot: buildStreamEventsSnapshot({
        threadId: "thread-1",
        events: [appendedEvent],
        nextSequence: 401,
        resetRequired: false,
      }),
      streamEventsSinceSequenceUsed: 399,
    });

    await waitFor(() => {
      expect(snapshotReference.current?.streamEvents.length).toBe(400);
      expect(snapshotReference.current?.streamEvents[0]).toEqual(initialEvents[1]);
      expect(snapshotReference.current?.streamEvents[399]).toBe(appendedEvent);
    });
  });
});

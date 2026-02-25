import {
  startTransition,
  useCallback,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction
} from "react";
import type { AgentId } from "@/Shared/Contracts/ApiContracts";
import { isRequestCanceledError } from "@/Shared/Errors/RequestCanceledError";
import {
  type CapabilityAgentsResponse
} from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import { PendingThreadMaterializationCoordinator } from "@/Features/Threads/StateManagement/PendingThreadMaterializationCoordinator";
import {
  type ThreadListItem
} from "@/Features/Threads/DomainModel/ThreadGroupTypes";
import {
  type ChatLiveStateResponse,
  type ChatReadThreadResponse,
  ChatServerClient,
  type ChatStreamEventsResponse
} from "../DataAccess/ChatServerClient";
import { ConversationSyncSignatureBuilder } from "../DomainModel/ConversationSyncSignatureBuilder";
import { ReadThreadStateMerger } from "./ReadThreadStateMerger";
import {
  SelectedThreadDataRefreshCoordinator
} from "./SelectedThreadDataRefreshCoordinator";
import {
  SelectedThreadRefreshConcurrencyCoordinator,
  type SelectedThreadRefreshRequest
} from "./SelectedThreadRefreshConcurrencyCoordinator";

export interface LoadSelectedThreadOptions {
  includeTurns?: boolean;
  includeReadThread?: boolean;
}

export interface ApplySelectedThreadStreamDeltaInput {
  threadId: string;
  liveStateSnapshot: LiveStateResponse;
  streamEventsSnapshot: StreamEventsResponse;
  streamEventsSinceSequenceUsed: number | null;
}

type LiveStateResponse = ChatLiveStateResponse;
type StreamEventsResponse = ChatStreamEventsResponse;
type ReadThreadResponse = ChatReadThreadResponse;
type AgentDescriptor = CapabilityAgentsResponse["agents"][number];
type Thread = ThreadListItem;

export interface UseSelectedThreadLoadersInput {
  threads: Thread[];
  selectedAgentId: AgentId;
  agentsById: Partial<Record<AgentId, AgentDescriptor>>;
  appDefaultModel: string;
  appDefaultReasoningEffort: string;
  selectedThreadIdRef: MutableRefObject<string | null>;
  pendingThreadMaterializationCoordinator: PendingThreadMaterializationCoordinator;
  conversationSyncSignatureBuilder: ConversationSyncSignatureBuilder;
  selectedThreadDataRefreshCoordinator: SelectedThreadDataRefreshCoordinator;
  selectedThreadRefreshConcurrencyCoordinator: SelectedThreadRefreshConcurrencyCoordinator;
  readThreadStateMerger: ReadThreadStateMerger;
  chatServerClient: ChatServerClient;
  setLiveState: Dispatch<SetStateAction<LiveStateResponse | null>>;
  setReadThreadState: Dispatch<SetStateAction<ReadThreadResponse | null>>;
  setStreamEvents: Dispatch<SetStateAction<StreamEventsResponse["events"]>>;
}

export interface SelectedThreadLoaders {
  loadSelectedThread: (
    threadId: string,
    options?: LoadSelectedThreadOptions,
    signal?: AbortSignal
  ) => Promise<void>;
  loadSelectedThreadTracked: (threadId: string, options?: LoadSelectedThreadOptions) => Promise<void>;
  applySelectedThreadStreamDelta: (input: ApplySelectedThreadStreamDeltaInput) => void;
}

const STREAM_EVENT_RETENTION_LIMIT = 400;

export function useSelectedThreadLoaders(
  input: UseSelectedThreadLoadersInput
): SelectedThreadLoaders {
  const nextStreamSequenceByThreadReference = useRef<Map<string, number>>(new Map());

  const applySnapshotsToState = useCallback((snapshotInput: {
    threadId: string;
    liveStateSnapshot: LiveStateResponse;
    streamEventsSnapshot: StreamEventsResponse;
    streamEventsSinceSequenceUsed: number | null;
    readThreadSnapshot: ReadThreadResponse | null;
    includeTurnsUsedForRead: boolean;
  }) => {
    const containsAnyTurns = (
      (snapshotInput.liveStateSnapshot.conversationState?.turns.length ?? 0) > 0
      || (snapshotInput.readThreadSnapshot?.thread.turns.length ?? 0) > 0
    );
    if (containsAnyTurns) {
      input.pendingThreadMaterializationCoordinator.clearPending(snapshotInput.threadId);
    }

    nextStreamSequenceByThreadReference.current.set(
      snapshotInput.threadId,
      snapshotInput.streamEventsSnapshot.nextSequence
    );

    startTransition(() => {
      input.setLiveState((previousLiveState) => {
        if (
          input.conversationSyncSignatureBuilder.buildLiveStateSyncSignature(
            previousLiveState,
            input.appDefaultModel,
            input.appDefaultReasoningEffort
          )
          === input.conversationSyncSignatureBuilder.buildLiveStateSyncSignature(
            snapshotInput.liveStateSnapshot,
            input.appDefaultModel,
            input.appDefaultReasoningEffort
          )
        ) {
          return previousLiveState;
        }
        return snapshotInput.liveStateSnapshot;
      });

      const readThreadSnapshot = snapshotInput.readThreadSnapshot;
      if (readThreadSnapshot) {
        input.setReadThreadState((previousReadThreadState) => {
          const mergedReadThread = input.readThreadStateMerger.merge<ReadThreadResponse>({
            previous: previousReadThreadState,
            incoming: readThreadSnapshot,
            includeTurns: snapshotInput.includeTurnsUsedForRead
          });

          if (
            input.conversationSyncSignatureBuilder.buildReadThreadSyncSignature(
              previousReadThreadState,
              input.appDefaultModel,
              input.appDefaultReasoningEffort
            )
            === input.conversationSyncSignatureBuilder.buildReadThreadSyncSignature(
              mergedReadThread,
              input.appDefaultModel,
              input.appDefaultReasoningEffort
            )
          ) {
            return previousReadThreadState;
          }

          return mergedReadThread;
        });
      }

      input.setStreamEvents((previousStreamEvents) => {
        if (snapshotInput.streamEventsSnapshot.resetRequired) {
          if (matchesStreamEventTail(previousStreamEvents, snapshotInput.streamEventsSnapshot.events)) {
            return previousStreamEvents;
          }
          return snapshotInput.streamEventsSnapshot.events;
        }

        if (snapshotInput.streamEventsSinceSequenceUsed !== null) {
          if (snapshotInput.streamEventsSnapshot.events.length === 0) {
            return previousStreamEvents;
          }

          // Cursor-based reads return only unseen events, so state can append deterministically.
          const mergedEvents = previousStreamEvents.concat(snapshotInput.streamEventsSnapshot.events);
          return mergedEvents.length > STREAM_EVENT_RETENTION_LIMIT
            ? mergedEvents.slice(-STREAM_EVENT_RETENTION_LIMIT)
            : mergedEvents;
        }

        if (matchesStreamEventTail(previousStreamEvents, snapshotInput.streamEventsSnapshot.events)) {
          return previousStreamEvents;
        }
        return snapshotInput.streamEventsSnapshot.events;
      });
    });
  }, [
    input.appDefaultModel,
    input.appDefaultReasoningEffort,
    input.conversationSyncSignatureBuilder,
    input.pendingThreadMaterializationCoordinator,
    input.readThreadStateMerger,
    input.setLiveState,
    input.setReadThreadState,
    input.setStreamEvents
  ]);

  const loadSelectedThread = useCallback(async (
    threadId: string,
    options?: LoadSelectedThreadOptions,
    signal?: AbortSignal
  ) => {
    const includeTurns = options?.includeTurns
      ?? !input.pendingThreadMaterializationCoordinator.isPending(threadId);
    const includeReadThread = options?.includeReadThread ?? true;
    const thread = input.threads.find((entry) => entry.id === threadId) ?? null;
    const threadAgentId = thread?.agentId ?? input.selectedAgentId;
    const descriptor = input.agentsById[threadAgentId];
    const canReadLiveState = descriptor?.capabilities.canReadLiveState ?? (threadAgentId === "codex");
    const canReadStreamEvents = descriptor?.capabilities.canReadStreamEvents ?? (threadAgentId === "codex");
    const streamEventsSinceSequence = canReadStreamEvents
      ? (nextStreamSequenceByThreadReference.current.get(threadId) ?? null)
      : null;

    const snapshot = await input.selectedThreadDataRefreshCoordinator.readSnapshot({
      threadId,
      includeTurns,
      includeReadThread,
      canReadLiveState,
      canReadStreamEvents,
      streamEventsSinceSequence,
      chatClient: input.chatServerClient,
      ...(signal ? { signal } : {})
    });

    if (signal?.aborted || input.selectedThreadIdRef.current !== threadId) {
      return;
    }

    applySnapshotsToState({
      threadId,
      liveStateSnapshot: snapshot.liveStateSnapshot,
      streamEventsSnapshot: snapshot.streamEventsSnapshot,
      streamEventsSinceSequenceUsed: snapshot.streamEventsSinceSequenceUsed,
      readThreadSnapshot: snapshot.readThreadSnapshot,
      includeTurnsUsedForRead: snapshot.includeTurnsUsedForRead
    });
  }, [
    applySnapshotsToState,
    input.agentsById,
    input.chatServerClient,
    input.pendingThreadMaterializationCoordinator,
    input.selectedAgentId,
    input.selectedThreadDataRefreshCoordinator,
    input.selectedThreadIdRef,
    input.threads
  ]);

  const loadSelectedThreadTracked = useCallback(async (threadId: string, options?: LoadSelectedThreadOptions) => {
    const request: SelectedThreadRefreshRequest = {
      threadId,
      includeTurns: options?.includeTurns ?? !input.pendingThreadMaterializationCoordinator.isPending(threadId),
      includeReadThread: options?.includeReadThread ?? true
    };

    await input.selectedThreadRefreshConcurrencyCoordinator.run({
      request,
      executeRefresh: async (nextRequest, signal) => {
        await loadSelectedThread(
          nextRequest.threadId,
          {
            includeTurns: nextRequest.includeTurns,
            includeReadThread: nextRequest.includeReadThread
          },
          signal
        );
      },
      isCanceledError: isRequestCanceledError
    });
  }, [
    input.pendingThreadMaterializationCoordinator,
    input.selectedThreadRefreshConcurrencyCoordinator,
    loadSelectedThread
  ]);

  const applySelectedThreadStreamDelta = useCallback((streamDeltaInput: ApplySelectedThreadStreamDeltaInput) => {
    if (input.selectedThreadIdRef.current !== streamDeltaInput.threadId) {
      return;
    }

    applySnapshotsToState({
      threadId: streamDeltaInput.threadId,
      liveStateSnapshot: streamDeltaInput.liveStateSnapshot,
      streamEventsSnapshot: streamDeltaInput.streamEventsSnapshot,
      streamEventsSinceSequenceUsed: streamDeltaInput.streamEventsSinceSequenceUsed,
      readThreadSnapshot: null,
      includeTurnsUsedForRead: false
    });
  }, [
    applySnapshotsToState,
    input.selectedThreadIdRef
  ]);

  return {
    loadSelectedThread,
    loadSelectedThreadTracked,
    applySelectedThreadStreamDelta
  };
}

function matchesStreamEventTail(previousEvents: StreamEventsResponse["events"], nextEvents: StreamEventsResponse["events"]): boolean {
  const previousLastEvent = previousEvents[previousEvents.length - 1];
  const nextLastEvent = nextEvents[nextEvents.length - 1];
  const previousLastSignature = previousLastEvent ? JSON.stringify(previousLastEvent) : "";
  const nextLastSignature = nextLastEvent ? JSON.stringify(nextLastEvent) : "";
  return previousEvents.length === nextEvents.length && previousLastSignature === nextLastSignature;
}

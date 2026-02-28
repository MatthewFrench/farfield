import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useRef,
} from "react";
import { type CapabilityAgentsResponse } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import { type SelectedThreadSnapshotCacheStore } from "@/Features/Chat/DataAccess/SelectedThreadSnapshotIndexedDatabaseStore";
import { type ThreadListItem } from "@/Features/Threads/DomainModel/ThreadGroupTypes";
import { PendingThreadMaterializationCoordinator } from "@/Features/Threads/StateManagement/PendingThreadMaterializationCoordinator";
import { type ThreadDisplayNameStateOwner } from "@/Features/Threads/StateManagement/ThreadDisplayNameStateOwner";
import type { AgentId } from "@/Shared/Contracts/ApiContracts";
import { isRequestCanceledError } from "@/Shared/Errors/RequestCanceledError";
import {
  type ChatLiveStateResponse,
  type ChatReadThreadResponse,
  ChatServerClient,
  type ChatStreamEventsResponse,
} from "../DataAccess/ChatServerClient";
import { ConversationSyncSignatureBuilder } from "../DomainModel/ConversationSyncSignatureBuilder";
import { resolveReadCapabilitiesForThread } from "../DomainModel/SelectedThreadReadCapabilitiesResolver";
import { ReadThreadStateMerger } from "./ReadThreadStateMerger";
import { SelectedThreadDataRefreshCoordinator } from "./SelectedThreadDataRefreshCoordinator";
import {
  SelectedThreadRefreshConcurrencyCoordinator,
  type SelectedThreadRefreshRequest,
} from "./SelectedThreadRefreshConcurrencyCoordinator";
import {
  SelectedThreadSnapshotStateOwner,
  type SelectedThreadSnapshotStateOwnerDependencies,
  type ApplySelectedThreadStreamDeltaInput as SelectedThreadStreamDeltaInput,
} from "./SelectedThreadSnapshotStateOwner";

export interface LoadSelectedThreadOptions {
  includeTurns?: boolean;
  includeReadThread?: boolean;
}

export type ApplySelectedThreadStreamDeltaInput = SelectedThreadStreamDeltaInput;

type LiveStateResponse = ChatLiveStateResponse;
type StreamEventsResponse = ChatStreamEventsResponse;
type ReadThreadResponse = ChatReadThreadResponse;
type AgentDescriptor = CapabilityAgentsResponse["agents"][number];
type Thread = ThreadListItem;

const DEFAULT_INCLUDE_READ_THREAD = true;

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
  selectedThreadSnapshotCacheStore: SelectedThreadSnapshotCacheStore;
  threadDisplayNameStateOwner: ThreadDisplayNameStateOwner;
  setLiveState: Dispatch<SetStateAction<LiveStateResponse | null>>;
  setReadThreadState: Dispatch<SetStateAction<ReadThreadResponse | null>>;
  setStreamEvents: Dispatch<SetStateAction<StreamEventsResponse["events"]>>;
}

export interface SelectedThreadLoaders {
  loadSelectedThread: (
    threadId: string,
    options?: LoadSelectedThreadOptions,
    signal?: AbortSignal,
  ) => Promise<void>;
  loadSelectedThreadTracked: (
    threadId: string,
    options?: LoadSelectedThreadOptions,
  ) => Promise<void>;
  applySelectedThreadStreamDelta: (input: ApplySelectedThreadStreamDeltaInput) => void;
}

function createSnapshotStateOwnerDependencies(
  input: UseSelectedThreadLoadersInput,
): SelectedThreadSnapshotStateOwnerDependencies {
  return {
    appDefaultModel: input.appDefaultModel,
    appDefaultReasoningEffort: input.appDefaultReasoningEffort,
    selectedThreadIdRef: input.selectedThreadIdRef,
    pendingThreadMaterializationCoordinator: input.pendingThreadMaterializationCoordinator,
    conversationSyncSignatureBuilder: input.conversationSyncSignatureBuilder,
    readThreadStateMerger: input.readThreadStateMerger,
    threadDisplayNameStateOwner: input.threadDisplayNameStateOwner,
    setLiveState: input.setLiveState,
    setReadThreadState: input.setReadThreadState,
    setStreamEvents: input.setStreamEvents,
  };
}

function resolveIncludeTurnsForThreadRead(
  includeTurns: boolean | undefined,
  threadId: string,
  pendingThreadMaterializationCoordinator: PendingThreadMaterializationCoordinator,
): boolean {
  return includeTurns ?? !pendingThreadMaterializationCoordinator.isPending(threadId);
}

function resolveIncludeReadThreadForThreadRead(includeReadThread: boolean | undefined): boolean {
  return includeReadThread ?? DEFAULT_INCLUDE_READ_THREAD;
}

interface ResolveReadThreadDeltaPreferenceInput {
  includeReadThread: boolean;
  canReadLiveState: boolean;
  canReadStreamEvents: boolean;
  streamEventsSinceSequence: number | null;
  hasPersistedSnapshot: boolean;
}

function shouldUseStreamDeltaRefreshWithoutReadThread(
  input: ResolveReadThreadDeltaPreferenceInput,
): boolean {
  // Once we have a trusted baseline snapshot and a stream cursor, live-state + stream delta reads
  // keep selected-thread state fresh without issuing a full read-thread request each refresh.
  if (!input.includeReadThread) {
    return false;
  }
  if (!input.canReadLiveState || !input.canReadStreamEvents) {
    return false;
  }
  return input.hasPersistedSnapshot || input.streamEventsSinceSequence !== null;
}

/**
 * Thin composition hook for selected-thread loading orchestration.
 * Mutable state updates and cursor tracking are owned by SelectedThreadSnapshotStateOwner.
 */
export function useSelectedThreadLoaders(
  input: UseSelectedThreadLoadersInput,
): SelectedThreadLoaders {
  const snapshotStateOwnerReference = useRef<SelectedThreadSnapshotStateOwner | null>(null);
  if (snapshotStateOwnerReference.current === null) {
    snapshotStateOwnerReference.current = new SelectedThreadSnapshotStateOwner(
      createSnapshotStateOwnerDependencies(input),
    );
  } else {
    snapshotStateOwnerReference.current.updateDependencies(
      createSnapshotStateOwnerDependencies(input),
    );
  }
  const snapshotStateOwner = snapshotStateOwnerReference.current;

  const loadSelectedThread = useCallback(
    async (threadId: string, options?: LoadSelectedThreadOptions, signal?: AbortSignal) => {
      const includeTurns = resolveIncludeTurnsForThreadRead(
        options?.includeTurns,
        threadId,
        input.pendingThreadMaterializationCoordinator,
      );
      const includeReadThread = resolveIncludeReadThreadForThreadRead(options?.includeReadThread);
      const readCapabilities = resolveReadCapabilitiesForThread({
        threadId,
        threads: input.threads,
        selectedAgentId: input.selectedAgentId,
        agentsById: input.agentsById,
      });
      const persistedSnapshot = await input.selectedThreadSnapshotCacheStore.readSnapshot(threadId);
      if (
        persistedSnapshot !== null &&
        !snapshotStateOwner.shouldSkipSnapshotApply(threadId, signal)
      ) {
        snapshotStateOwner.applySnapshots({
          threadId: persistedSnapshot.threadId,
          liveStateSnapshot: persistedSnapshot.liveStateSnapshot,
          streamEventsSnapshot: persistedSnapshot.streamEventsSnapshot,
          streamEventsSinceSequenceUsed: persistedSnapshot.streamEventsSinceSequenceUsed,
          readThreadSnapshot: persistedSnapshot.readThreadSnapshot,
          includeTurnsUsedForRead: persistedSnapshot.includeTurnsUsedForRead,
        });
      }

      if (snapshotStateOwner.shouldSkipSnapshotApply(threadId, signal)) {
        return;
      }

      const streamEventsSinceSequence = readCapabilities.canReadStreamEvents
        ? snapshotStateOwner.readStreamEventsSinceSequence(threadId)
        : null;
      const includeReadThreadForRefresh = shouldUseStreamDeltaRefreshWithoutReadThread({
        includeReadThread,
        canReadLiveState: readCapabilities.canReadLiveState,
        canReadStreamEvents: readCapabilities.canReadStreamEvents,
        streamEventsSinceSequence,
        hasPersistedSnapshot: persistedSnapshot !== null,
      })
        ? false
        : includeReadThread;
      const snapshot = await input.selectedThreadDataRefreshCoordinator.readSnapshot({
        threadId,
        includeTurns,
        includeReadThread: includeReadThreadForRefresh,
        canReadLiveState: readCapabilities.canReadLiveState,
        canReadStreamEvents: readCapabilities.canReadStreamEvents,
        streamEventsSinceSequence,
        baselineLiveStateSnapshot: persistedSnapshot?.liveStateSnapshot ?? null,
        chatClient: input.chatServerClient,
        ...(signal ? { signal } : {}),
      });

      if (snapshotStateOwner.shouldSkipSnapshotApply(threadId, signal)) {
        return;
      }

      snapshotStateOwner.applySnapshots({
        threadId,
        liveStateSnapshot: snapshot.liveStateSnapshot,
        streamEventsSnapshot: snapshot.streamEventsSnapshot,
        streamEventsSinceSequenceUsed: snapshot.streamEventsSinceSequenceUsed,
        readThreadSnapshot: snapshot.readThreadSnapshot,
        includeTurnsUsedForRead: snapshot.includeTurnsUsedForRead,
      });
      void input.selectedThreadSnapshotCacheStore
        .writeSnapshot({
          threadId,
          liveStateSnapshot: snapshot.liveStateSnapshot,
          streamEventsSnapshot: snapshot.streamEventsSnapshot,
          streamEventsSinceSequenceUsed: snapshot.streamEventsSinceSequenceUsed,
          readThreadSnapshot: snapshot.readThreadSnapshot,
          includeTurnsUsedForRead: snapshot.includeTurnsUsedForRead,
        })
        .catch(() => {
          // Keep snapshot writes non-blocking for selected-thread rendering.
        });
    },
    [
      input.agentsById,
      input.chatServerClient,
      input.pendingThreadMaterializationCoordinator,
      input.selectedAgentId,
      input.selectedThreadDataRefreshCoordinator,
      input.selectedThreadSnapshotCacheStore,
      input.threads,
      snapshotStateOwner,
    ],
  );

  const loadSelectedThreadTracked = useCallback(
    async (threadId: string, options?: LoadSelectedThreadOptions) => {
      const request: SelectedThreadRefreshRequest = {
        threadId,
        includeTurns: resolveIncludeTurnsForThreadRead(
          options?.includeTurns,
          threadId,
          input.pendingThreadMaterializationCoordinator,
        ),
        includeReadThread: resolveIncludeReadThreadForThreadRead(options?.includeReadThread),
      };

      await input.selectedThreadRefreshConcurrencyCoordinator.run({
        request,
        executeRefresh: async (nextRequest, signal) => {
          await loadSelectedThread(
            nextRequest.threadId,
            {
              includeTurns: nextRequest.includeTurns,
              includeReadThread: nextRequest.includeReadThread,
            },
            signal,
          );
        },
        isCanceledError: isRequestCanceledError,
      });
    },
    [
      input.pendingThreadMaterializationCoordinator,
      input.selectedThreadRefreshConcurrencyCoordinator,
      loadSelectedThread,
    ],
  );

  const applySelectedThreadStreamDelta = useCallback(
    (streamDeltaInput: ApplySelectedThreadStreamDeltaInput) => {
      snapshotStateOwner.applySelectedThreadStreamDelta(streamDeltaInput);
    },
    [snapshotStateOwner],
  );

  return {
    loadSelectedThread,
    loadSelectedThreadTracked,
    applySelectedThreadStreamDelta,
  };
}

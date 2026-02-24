import {
  startTransition,
  useCallback,
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
}

export function useSelectedThreadLoaders(
  input: UseSelectedThreadLoadersInput
): SelectedThreadLoaders {
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

    const snapshot = await input.selectedThreadDataRefreshCoordinator.readSnapshot({
      threadId,
      includeTurns,
      includeReadThread,
      canReadLiveState,
      canReadStreamEvents,
      chatClient: input.chatServerClient,
      ...(signal ? { signal } : {})
    });

    if (signal?.aborted || input.selectedThreadIdRef.current !== threadId) {
      return;
    }

    if (snapshot.containsAnyTurns) {
      input.pendingThreadMaterializationCoordinator.clearPending(threadId);
    }

    startTransition(() => {
      input.setLiveState((previousLiveState) => {
        if (
          input.conversationSyncSignatureBuilder.buildLiveStateSyncSignature(
            previousLiveState,
            input.appDefaultModel,
            input.appDefaultReasoningEffort
          )
          === input.conversationSyncSignatureBuilder.buildLiveStateSyncSignature(
            snapshot.liveStateSnapshot,
            input.appDefaultModel,
            input.appDefaultReasoningEffort
          )
        ) {
          return previousLiveState;
        }
        return snapshot.liveStateSnapshot;
      });

      const readThreadSnapshot = snapshot.readThreadSnapshot;
      if (readThreadSnapshot) {
        input.setReadThreadState((previousReadThreadState) => {
          const mergedReadThread = input.readThreadStateMerger.merge<ReadThreadResponse>({
            previous: previousReadThreadState,
            incoming: readThreadSnapshot,
            includeTurns: snapshot.includeTurnsUsedForRead
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
        const previousLastEvent = previousStreamEvents[previousStreamEvents.length - 1];
        const nextLastEvent = snapshot.streamEventsSnapshot.events[snapshot.streamEventsSnapshot.events.length - 1];
        const previousLastSignature = previousLastEvent ? JSON.stringify(previousLastEvent) : "";
        const nextLastSignature = nextLastEvent ? JSON.stringify(nextLastEvent) : "";

        if (
          previousStreamEvents.length === snapshot.streamEventsSnapshot.events.length
          && previousLastSignature === nextLastSignature
        ) {
          return previousStreamEvents;
        }

        return snapshot.streamEventsSnapshot.events;
      });
    });
  }, [
    input.agentsById,
    input.appDefaultModel,
    input.appDefaultReasoningEffort,
    input.chatServerClient,
    input.conversationSyncSignatureBuilder,
    input.pendingThreadMaterializationCoordinator,
    input.readThreadStateMerger,
    input.selectedAgentId,
    input.selectedThreadDataRefreshCoordinator,
    input.selectedThreadIdRef,
    input.setLiveState,
    input.setReadThreadState,
    input.setStreamEvents,
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

  return {
    loadSelectedThread,
    loadSelectedThreadTracked
  };
}

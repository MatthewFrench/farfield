import { type Dispatch, type MutableRefObject, type SetStateAction, startTransition } from "react";
import { PendingThreadMaterializationCoordinator } from "@/Features/Threads/StateManagement/PendingThreadMaterializationCoordinator";
import {
  type ChatLiveStateResponse,
  type ChatReadThreadResponse,
  type ChatStreamEventsResponse,
} from "../DataAccess/ChatServerClient";
import { ConversationSyncSignatureBuilder } from "../DomainModel/ConversationSyncSignatureBuilder";
import { resolveNextStreamEventsState } from "../DomainModel/SelectedThreadStreamEventStateResolver";
import { ReadThreadStateMerger } from "./ReadThreadStateMerger";

type LiveStateResponse = ChatLiveStateResponse;
type StreamEventsResponse = ChatStreamEventsResponse;
type ReadThreadResponse = ChatReadThreadResponse;

export interface ApplySelectedThreadStreamDeltaInput {
  threadId: string;
  liveStateSnapshot: LiveStateResponse;
  streamEventsSnapshot: StreamEventsResponse;
  streamEventsSinceSequenceUsed: number | null;
}

export interface ApplySnapshotsToStateInput {
  threadId: string;
  liveStateSnapshot: LiveStateResponse;
  streamEventsSnapshot: StreamEventsResponse;
  streamEventsSinceSequenceUsed: number | null;
  readThreadSnapshot: ReadThreadResponse | null;
  includeTurnsUsedForRead: boolean;
}

export interface SelectedThreadSnapshotStateOwnerDependencies {
  appDefaultModel: string;
  appDefaultReasoningEffort: string;
  selectedThreadIdRef: MutableRefObject<string | null>;
  pendingThreadMaterializationCoordinator: PendingThreadMaterializationCoordinator;
  conversationSyncSignatureBuilder: ConversationSyncSignatureBuilder;
  readThreadStateMerger: ReadThreadStateMerger;
  setLiveState: Dispatch<SetStateAction<LiveStateResponse | null>>;
  setReadThreadState: Dispatch<SetStateAction<ReadThreadResponse | null>>;
  setStreamEvents: Dispatch<SetStateAction<StreamEventsResponse["events"]>>;
}

function hasTurnsInSelectedThreadSnapshots(
  liveStateSnapshot: LiveStateResponse,
  readThreadSnapshot: ReadThreadResponse | null,
): boolean {
  return (
    (liveStateSnapshot.conversationState?.turns.length ?? 0) > 0 ||
    (readThreadSnapshot?.thread.turns.length ?? 0) > 0
  );
}

/**
 * Owns selected-thread snapshot state application and stream cursor tracking.
 * Hook composition delegates mutation logic to this owner to keep state transitions explicit.
 */
export class SelectedThreadSnapshotStateOwner {
  private deps: SelectedThreadSnapshotStateOwnerDependencies;
  private readonly streamEventsSinceSequenceByThreadId = new Map<string, number>();
  private lastAppliedThreadId: string | null = null;

  public constructor(dependencies: SelectedThreadSnapshotStateOwnerDependencies) {
    this.deps = dependencies;
  }

  public updateDependencies(dependencies: SelectedThreadSnapshotStateOwnerDependencies): void {
    this.deps = dependencies;
  }

  public readStreamEventsSinceSequence(threadId: string): number | null {
    return this.readStreamEventsSinceSequenceForRead(threadId);
  }

  public shouldSkipSnapshotApply(threadId: string, signal?: AbortSignal): boolean {
    return Boolean(signal?.aborted) || this.deps.selectedThreadIdRef.current !== threadId;
  }

  public applySnapshots(snapshotInput: ApplySnapshotsToStateInput): void {
    const expectedSinceSequence = this.readStreamEventsSinceSequenceForRead(snapshotInput.threadId);
    const containsAnyTurns = hasTurnsInSelectedThreadSnapshots(
      snapshotInput.liveStateSnapshot,
      snapshotInput.readThreadSnapshot,
    );
    if (containsAnyTurns) {
      this.deps.pendingThreadMaterializationCoordinator.clearPending(snapshotInput.threadId);
    }

    const nextSinceSequence = this.resolveNextStreamEventsSinceSequence({
      expectedSinceSequence,
      streamEventsSnapshot: snapshotInput.streamEventsSnapshot,
      streamEventsSinceSequenceUsed: snapshotInput.streamEventsSinceSequenceUsed,
    });
    this.writeStreamEventsSinceSequence(snapshotInput.threadId, nextSinceSequence);
    this.lastAppliedThreadId = snapshotInput.threadId;

    startTransition(() => {
      this.deps.setLiveState((previousLiveState) => {
        if (
          this.deps.conversationSyncSignatureBuilder.buildLiveStateSyncSignature(
            previousLiveState,
            this.deps.appDefaultModel,
            this.deps.appDefaultReasoningEffort,
          ) ===
          this.deps.conversationSyncSignatureBuilder.buildLiveStateSyncSignature(
            snapshotInput.liveStateSnapshot,
            this.deps.appDefaultModel,
            this.deps.appDefaultReasoningEffort,
          )
        ) {
          return previousLiveState;
        }
        return snapshotInput.liveStateSnapshot;
      });

      const readThreadSnapshot = snapshotInput.readThreadSnapshot;
      if (readThreadSnapshot !== null) {
        this.deps.setReadThreadState((previousReadThreadState) => {
          const mergedReadThread = this.deps.readThreadStateMerger.merge<ReadThreadResponse>({
            previous: previousReadThreadState,
            incoming: readThreadSnapshot,
            includeTurns: snapshotInput.includeTurnsUsedForRead,
          });

          if (
            this.deps.conversationSyncSignatureBuilder.buildReadThreadSyncSignature(
              previousReadThreadState,
              this.deps.appDefaultModel,
              this.deps.appDefaultReasoningEffort,
            ) ===
            this.deps.conversationSyncSignatureBuilder.buildReadThreadSyncSignature(
              mergedReadThread,
              this.deps.appDefaultModel,
              this.deps.appDefaultReasoningEffort,
            )
          ) {
            return previousReadThreadState;
          }

          return mergedReadThread;
        });
      }

      this.deps.setStreamEvents((previousStreamEvents) =>
        resolveNextStreamEventsState({
          previousStreamEvents,
          streamEventsSnapshot: snapshotInput.streamEventsSnapshot,
          streamEventsSinceSequenceUsed: snapshotInput.streamEventsSinceSequenceUsed,
          expectedSinceSequence,
        }),
      );
    });
  }

  public applySelectedThreadStreamDelta(
    streamDeltaInput: ApplySelectedThreadStreamDeltaInput,
  ): void {
    if (this.deps.selectedThreadIdRef.current !== streamDeltaInput.threadId) {
      return;
    }

    this.applySnapshots({
      threadId: streamDeltaInput.threadId,
      liveStateSnapshot: streamDeltaInput.liveStateSnapshot,
      streamEventsSnapshot: streamDeltaInput.streamEventsSnapshot,
      streamEventsSinceSequenceUsed: streamDeltaInput.streamEventsSinceSequenceUsed,
      readThreadSnapshot: null,
      includeTurnsUsedForRead: false,
    });
  }

  private readStreamEventsSinceSequenceForRead(threadId: string): number | null {
    if (this.lastAppliedThreadId !== threadId) {
      return null;
    }
    return this.streamEventsSinceSequenceByThreadId.get(threadId) ?? null;
  }

  private writeStreamEventsSinceSequence(threadId: string, sinceSequence: number | null): void {
    if (sinceSequence === null) {
      this.streamEventsSinceSequenceByThreadId.delete(threadId);
      return;
    }
    this.streamEventsSinceSequenceByThreadId.set(threadId, sinceSequence);
  }

  private resolveNextStreamEventsSinceSequence(input: {
    expectedSinceSequence: number | null;
    streamEventsSnapshot: StreamEventsResponse;
    streamEventsSinceSequenceUsed: number | null;
  }): number | null {
    const { expectedSinceSequence, streamEventsSnapshot, streamEventsSinceSequenceUsed } = input;
    if (
      streamEventsSinceSequenceUsed !== null &&
      !streamEventsSnapshot.resetRequired &&
      streamEventsSinceSequenceUsed !== expectedSinceSequence
    ) {
      return expectedSinceSequence;
    }

    if (streamEventsSnapshot.nextSequence === 0) {
      return null;
    }

    if (streamEventsSnapshot.resetRequired || streamEventsSnapshot.events.length > 0) {
      return streamEventsSnapshot.nextSequence - 1;
    }

    return expectedSinceSequence;
  }
}

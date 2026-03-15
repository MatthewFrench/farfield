import type { IpcFrame, JsonValue } from "@farfield/protocol";
import { type Dispatch, type MutableRefObject, type SetStateAction, startTransition } from "react";
import { type SelectedThreadSnapshotCacheRecord } from "@/Features/Chat/DataAccess/SelectedThreadSnapshotIndexedDatabaseStore";
import { PendingThreadMaterializationCoordinator } from "@/Features/Threads/StateManagement/PendingThreadMaterializationCoordinator";
import { type ThreadDisplayNameStateOwner } from "@/Features/Threads/StateManagement/ThreadDisplayNameStateOwner";
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

type SnapshotStateApplicationMode = "immediate" | "transition";

export interface SelectedThreadSnapshotStateOwnerDependencies {
  appDefaultModel: string;
  appDefaultReasoningEffort: string;
  selectedThreadIdRef: MutableRefObject<string | null>;
  pendingThreadMaterializationCoordinator: PendingThreadMaterializationCoordinator;
  conversationSyncSignatureBuilder: ConversationSyncSignatureBuilder;
  readThreadStateMerger: ReadThreadStateMerger;
  threadDisplayNameStateOwner: ThreadDisplayNameStateOwner;
  setLiveState: Dispatch<SetStateAction<LiveStateResponse | null>>;
  setReadThreadState: Dispatch<SetStateAction<ReadThreadResponse | null>>;
  setStreamEvents: Dispatch<SetStateAction<StreamEventsResponse["events"]>>;
  persistSelectedThreadSnapshot: (snapshot: SelectedThreadSnapshotCacheRecord) => void;
}

function normalizeOptionalThreadDisplayName(value: string | null | undefined): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    return undefined;
  }
  return trimmedValue;
}

function readThreadDisplayNameFromSnapshots(
  snapshotInput: ApplySnapshotsToStateInput,
): string | undefined {
  const parsedReadThreadDisplayName = normalizeOptionalThreadDisplayName(
    snapshotInput.readThreadSnapshot?.thread.title,
  );
  if (parsedReadThreadDisplayName !== undefined) {
    return parsedReadThreadDisplayName;
  }
  return normalizeOptionalThreadDisplayName(
    snapshotInput.liveStateSnapshot.conversationState?.title,
  );
}

function areJsonValuesEqual(
  leftValue: JsonValue | undefined,
  rightValue: JsonValue | undefined,
): boolean {
  if (leftValue === rightValue) {
    return true;
  }
  if (leftValue === undefined || rightValue === undefined) {
    return false;
  }
  if (leftValue === null || rightValue === null) {
    return leftValue === rightValue;
  }
  if (Array.isArray(leftValue) || Array.isArray(rightValue)) {
    if (!Array.isArray(leftValue) || !Array.isArray(rightValue)) {
      return false;
    }
    if (leftValue.length !== rightValue.length) {
      return false;
    }
    for (let index = 0; index < leftValue.length; index += 1) {
      if (!areJsonValuesEqual(leftValue[index], rightValue[index])) {
        return false;
      }
    }
    return true;
  }
  if (typeof leftValue === "object" || typeof rightValue === "object") {
    if (typeof leftValue !== "object" || typeof rightValue !== "object") {
      return false;
    }
    const leftKeys = Object.keys(leftValue);
    const rightKeys = Object.keys(rightValue);
    if (leftKeys.length !== rightKeys.length) {
      return false;
    }
    for (const leftKey of leftKeys) {
      if (!(leftKey in rightValue)) {
        return false;
      }
      if (!areJsonValuesEqual(leftValue[leftKey], rightValue[leftKey])) {
        return false;
      }
    }
    return true;
  }
  return false;
}

function areIpcFramesEqual(previousEvent: IpcFrame, nextEvent: IpcFrame): boolean {
  if (previousEvent === nextEvent) {
    return true;
  }
  if (previousEvent.type !== nextEvent.type) {
    return false;
  }

  switch (previousEvent.type) {
    case "request":
      return (
        nextEvent.type === "request" &&
        previousEvent.requestId === nextEvent.requestId &&
        previousEvent.method === nextEvent.method &&
        previousEvent.targetClientId === nextEvent.targetClientId &&
        previousEvent.sourceClientId === nextEvent.sourceClientId &&
        previousEvent.version === nextEvent.version &&
        areJsonValuesEqual(previousEvent.params, nextEvent.params)
      );
    case "response":
      return (
        nextEvent.type === "response" &&
        previousEvent.requestId === nextEvent.requestId &&
        previousEvent.method === nextEvent.method &&
        previousEvent.handledByClientId === nextEvent.handledByClientId &&
        previousEvent.resultType === nextEvent.resultType &&
        areJsonValuesEqual(previousEvent.result, nextEvent.result) &&
        areJsonValuesEqual(previousEvent.error, nextEvent.error)
      );
    case "broadcast":
      return (
        nextEvent.type === "broadcast" &&
        previousEvent.method === nextEvent.method &&
        previousEvent.sourceClientId === nextEvent.sourceClientId &&
        previousEvent.targetClientId === nextEvent.targetClientId &&
        previousEvent.version === nextEvent.version &&
        areJsonValuesEqual(previousEvent.params, nextEvent.params)
      );
    case "client-discovery-request":
      return (
        nextEvent.type === "client-discovery-request" &&
        previousEvent.requestId === nextEvent.requestId &&
        areIpcFramesEqual(previousEvent.request, nextEvent.request)
      );
    case "client-discovery-response":
      return (
        nextEvent.type === "client-discovery-response" &&
        previousEvent.requestId === nextEvent.requestId &&
        previousEvent.response.canHandle === nextEvent.response.canHandle
      );
  }
}

function areStreamEventCollectionsEqual(
  previousEvents: IpcFrame[],
  nextEvents: IpcFrame[],
): boolean {
  if (previousEvents.length !== nextEvents.length) {
    return false;
  }
  for (let index = 0; index < previousEvents.length; index += 1) {
    const previousEvent = previousEvents[index];
    const nextEvent = nextEvents[index];
    if (previousEvent === undefined || nextEvent === undefined) {
      return false;
    }
    if (!areIpcFramesEqual(previousEvent, nextEvent)) {
      return false;
    }
  }
  return true;
}

function areStreamEventSnapshotsEqual(
  previousSnapshot: StreamEventsResponse,
  nextSnapshot: StreamEventsResponse,
): boolean {
  return (
    previousSnapshot.threadId === nextSnapshot.threadId &&
    previousSnapshot.ownerClientId === nextSnapshot.ownerClientId &&
    previousSnapshot.nextSequence === nextSnapshot.nextSequence &&
    previousSnapshot.firstAvailableSequence === nextSnapshot.firstAvailableSequence &&
    previousSnapshot.resetRequired === nextSnapshot.resetRequired &&
    areStreamEventCollectionsEqual(previousSnapshot.events, nextSnapshot.events)
  );
}

/**
 * Owns selected-thread snapshot state application and stream cursor tracking.
 * Hook composition delegates mutation logic to this owner to keep state transitions explicit.
 */
export class SelectedThreadSnapshotStateOwner {
  private deps: SelectedThreadSnapshotStateOwnerDependencies;
  private readonly streamEventsSinceSequenceByThreadId = new Map<string, number>();
  private readonly latestSnapshotByThreadId = new Map<string, SelectedThreadSnapshotCacheRecord>();
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

  public hasAppliedSnapshot(threadId: string): boolean {
    return this.lastAppliedThreadId === threadId && this.latestSnapshotByThreadId.has(threadId);
  }

  public shouldSkipSnapshotApply(threadId: string, signal?: AbortSignal): boolean {
    return Boolean(signal?.aborted) || this.deps.selectedThreadIdRef.current !== threadId;
  }

  public applySnapshots(
    snapshotInput: ApplySnapshotsToStateInput,
    mode: SnapshotStateApplicationMode = "immediate",
  ): void {
    const expectedSinceSequence = this.readStreamEventsSinceSequenceForRead(snapshotInput.threadId);
    const threadDisplayName = readThreadDisplayNameFromSnapshots(snapshotInput);
    if (threadDisplayName !== undefined) {
      this.deps.threadDisplayNameStateOwner.writeThreadDisplayName(
        snapshotInput.threadId,
        threadDisplayName,
      );
    }
    if (snapshotInput.readThreadSnapshot !== null) {
      this.deps.pendingThreadMaterializationCoordinator.clearPending(snapshotInput.threadId);
    }

    const nextSinceSequence = this.resolveNextStreamEventsSinceSequence({
      expectedSinceSequence,
      streamEventsSnapshot: snapshotInput.streamEventsSnapshot,
      streamEventsSinceSequenceUsed: snapshotInput.streamEventsSinceSequenceUsed,
    });
    const persistedSnapshot = this.buildPersistedSnapshot(snapshotInput);
    if (!this.shouldApplySnapshotState(persistedSnapshot, nextSinceSequence)) {
      return;
    }
    this.latestSnapshotByThreadId.set(snapshotInput.threadId, persistedSnapshot);
    this.writeStreamEventsSinceSequence(snapshotInput.threadId, nextSinceSequence);
    this.lastAppliedThreadId = snapshotInput.threadId;
    this.deps.persistSelectedThreadSnapshot(persistedSnapshot);
    this.applySnapshotState(snapshotInput, expectedSinceSequence, mode);
  }

  public applySelectedThreadStreamDelta(
    streamDeltaInput: ApplySelectedThreadStreamDeltaInput,
  ): void {
    if (this.deps.selectedThreadIdRef.current !== streamDeltaInput.threadId) {
      return;
    }

    this.applySnapshots(
      {
        threadId: streamDeltaInput.threadId,
        liveStateSnapshot: streamDeltaInput.liveStateSnapshot,
        streamEventsSnapshot: streamDeltaInput.streamEventsSnapshot,
        streamEventsSinceSequenceUsed: streamDeltaInput.streamEventsSinceSequenceUsed,
        readThreadSnapshot: null,
        includeTurnsUsedForRead: false,
      },
      "transition",
    );
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

  private buildPersistedSnapshot(
    snapshotInput: ApplySnapshotsToStateInput,
  ): SelectedThreadSnapshotCacheRecord {
    const existingSnapshot = this.latestSnapshotByThreadId.get(snapshotInput.threadId) ?? null;
    const readThreadSnapshot =
      snapshotInput.readThreadSnapshot ?? existingSnapshot?.readThreadSnapshot ?? null;
    const includeTurnsUsedForRead =
      snapshotInput.readThreadSnapshot !== null
        ? snapshotInput.includeTurnsUsedForRead
        : (existingSnapshot?.includeTurnsUsedForRead ?? false);

    return {
      threadId: snapshotInput.threadId,
      liveStateSnapshot: snapshotInput.liveStateSnapshot,
      streamEventsSnapshot: snapshotInput.streamEventsSnapshot,
      streamEventsSinceSequenceUsed: snapshotInput.streamEventsSinceSequenceUsed,
      readThreadSnapshot,
      includeTurnsUsedForRead,
    };
  }

  private shouldApplySnapshotState(
    nextSnapshot: SelectedThreadSnapshotCacheRecord,
    nextSinceSequence: number | null,
  ): boolean {
    const previousSnapshot = this.latestSnapshotByThreadId.get(nextSnapshot.threadId);
    if (previousSnapshot === undefined) {
      return true;
    }
    if (
      this.deps.conversationSyncSignatureBuilder.buildLiveStateSyncSignature(
        previousSnapshot.liveStateSnapshot,
        this.deps.appDefaultModel,
        this.deps.appDefaultReasoningEffort,
      ) !==
      this.deps.conversationSyncSignatureBuilder.buildLiveStateSyncSignature(
        nextSnapshot.liveStateSnapshot,
        this.deps.appDefaultModel,
        this.deps.appDefaultReasoningEffort,
      )
    ) {
      return true;
    }
    if (
      this.deps.conversationSyncSignatureBuilder.buildReadThreadSyncSignature(
        previousSnapshot.readThreadSnapshot,
        this.deps.appDefaultModel,
        this.deps.appDefaultReasoningEffort,
      ) !==
      this.deps.conversationSyncSignatureBuilder.buildReadThreadSyncSignature(
        nextSnapshot.readThreadSnapshot,
        this.deps.appDefaultModel,
        this.deps.appDefaultReasoningEffort,
      )
    ) {
      return true;
    }
    if (
      !areStreamEventSnapshotsEqual(
        previousSnapshot.streamEventsSnapshot,
        nextSnapshot.streamEventsSnapshot,
      )
    ) {
      return true;
    }
    if (
      previousSnapshot.streamEventsSinceSequenceUsed !== nextSnapshot.streamEventsSinceSequenceUsed
    ) {
      return true;
    }
    if (previousSnapshot.includeTurnsUsedForRead !== nextSnapshot.includeTurnsUsedForRead) {
      return true;
    }
    return this.readStreamEventsSinceSequenceForRead(nextSnapshot.threadId) !== nextSinceSequence;
  }

  private applySnapshotState(
    snapshotInput: ApplySnapshotsToStateInput,
    expectedSinceSequence: number | null,
    mode: SnapshotStateApplicationMode,
  ): void {
    const applyStateUpdates = (): void => {
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
    };

    if (mode === "transition") {
      startTransition(applyStateUpdates);
      return;
    }
    applyStateUpdates();
  }
}

import type { AgentThreadLiveState } from "../Agents/Types.js";
import { appendSampleWindowValue, readNearestRankPercentile } from "./RequestTimingSampleWindow.js";

const DEFAULT_MAXIMUM_SAMPLES_PER_METRIC = 120;
const ASSISTANT_VISIBLE_TURN_ITEM_TYPE_SET = new Set([
  "agentMessage",
  "error",
  "reasoning",
  "plan",
  "planImplementation",
  "todo-list",
  "commandExecution",
  "fileChange",
  "contextCompaction",
  "webSearch",
  "modelChanged",
  "mcpToolCall",
  "collabAgentToolCall",
  "collabToolCall",
  "imageView",
  "enteredReviewMode",
  "exitedReviewMode",
]);

interface ThreadSendProgressWindow {
  sendAcceptedAtEpochMilliseconds: number;
  firstInboundThreadStreamStateChangedAtEpochMilliseconds: number | null;
  firstPublishedThreadStreamDeltaAtEpochMilliseconds: number | null;
  firstAssistantVisibleProgressAtEpochMilliseconds: number | null;
}

export interface ThreadSendProgressObservabilityStatistics {
  activeThreadCount: number;
  inboundSampleCount: number;
  publishedDeltaSampleCount: number;
  assistantVisibleSampleCount: number;
  lastAcceptedToFirstInboundThreadStreamStateChangedMs: number;
  p50AcceptedToFirstInboundThreadStreamStateChangedMs: number;
  p95AcceptedToFirstInboundThreadStreamStateChangedMs: number;
  lastAcceptedToFirstPublishedThreadDeltaMs: number;
  p50AcceptedToFirstPublishedThreadDeltaMs: number;
  p95AcceptedToFirstPublishedThreadDeltaMs: number;
  lastAcceptedToFirstAssistantVisibleProgressMs: number;
  p50AcceptedToFirstAssistantVisibleProgressMs: number;
  p95AcceptedToFirstAssistantVisibleProgressMs: number;
}

function clampDurationMilliseconds(
  endEpochMilliseconds: number,
  startEpochMilliseconds: number,
): number {
  return Math.max(0, endEpochMilliseconds - startEpochMilliseconds);
}

function readLastObservedSample(sampleWindowValues: readonly number[]): number {
  const lastObservedSample = sampleWindowValues[sampleWindowValues.length - 1];
  return lastObservedSample ?? 0;
}

function hasAssistantVisibleProgress(liveStateSnapshot: AgentThreadLiveState): boolean {
  const conversationState = liveStateSnapshot.conversationState;
  if (conversationState === null) {
    return false;
  }

  const lastTurn = conversationState.turns[conversationState.turns.length - 1];
  if (lastTurn === undefined) {
    return false;
  }

  if (
    lastTurn.finalAssistantStartedAtMs !== undefined &&
    lastTurn.finalAssistantStartedAtMs !== null
  ) {
    return true;
  }

  return lastTurn.items.some((item) => ASSISTANT_VISIBLE_TURN_ITEM_TYPE_SET.has(item.type));
}

export class ThreadSendProgressObservabilityOwner {
  private readonly maximumSamplesPerMetric: number;
  private readonly activeWindowByThreadId = new Map<string, ThreadSendProgressWindow>();
  private readonly acceptedToFirstInboundSamplesMilliseconds: number[] = [];
  private readonly acceptedToFirstPublishedDeltaSamplesMilliseconds: number[] = [];
  private readonly acceptedToFirstAssistantVisibleSamplesMilliseconds: number[] = [];

  public constructor(maximumSamplesPerMetric = DEFAULT_MAXIMUM_SAMPLES_PER_METRIC) {
    if (!Number.isInteger(maximumSamplesPerMetric) || maximumSamplesPerMetric <= 0) {
      throw new Error(
        "ThreadSendProgressObservabilityOwner requires positive integer maximumSamplesPerMetric",
      );
    }
    this.maximumSamplesPerMetric = maximumSamplesPerMetric;
  }

  public recordSendAccepted(threadId: string, atEpochMilliseconds: number): void {
    this.activeWindowByThreadId.set(threadId, {
      sendAcceptedAtEpochMilliseconds: atEpochMilliseconds,
      firstInboundThreadStreamStateChangedAtEpochMilliseconds: null,
      firstPublishedThreadStreamDeltaAtEpochMilliseconds: null,
      firstAssistantVisibleProgressAtEpochMilliseconds: null,
    });
  }

  public recordFirstInboundThreadStreamStateChanged(
    threadId: string,
    atEpochMilliseconds: number,
  ): void {
    const activeWindow = this.activeWindowByThreadId.get(threadId);
    if (
      activeWindow === undefined ||
      activeWindow.firstInboundThreadStreamStateChangedAtEpochMilliseconds !== null
    ) {
      return;
    }

    activeWindow.firstInboundThreadStreamStateChangedAtEpochMilliseconds = atEpochMilliseconds;
    appendSampleWindowValue(
      this.acceptedToFirstInboundSamplesMilliseconds,
      clampDurationMilliseconds(atEpochMilliseconds, activeWindow.sendAcceptedAtEpochMilliseconds),
      this.maximumSamplesPerMetric,
    );
  }

  public recordFirstPublishedThreadDelta(threadId: string, atEpochMilliseconds: number): void {
    const activeWindow = this.activeWindowByThreadId.get(threadId);
    if (
      activeWindow === undefined ||
      activeWindow.firstPublishedThreadStreamDeltaAtEpochMilliseconds !== null
    ) {
      return;
    }

    activeWindow.firstPublishedThreadStreamDeltaAtEpochMilliseconds = atEpochMilliseconds;
    appendSampleWindowValue(
      this.acceptedToFirstPublishedDeltaSamplesMilliseconds,
      clampDurationMilliseconds(atEpochMilliseconds, activeWindow.sendAcceptedAtEpochMilliseconds),
      this.maximumSamplesPerMetric,
    );
  }

  public recordFirstAssistantVisibleProgress(
    threadId: string,
    atEpochMilliseconds: number,
    liveStateSnapshot: AgentThreadLiveState,
  ): void {
    const activeWindow = this.activeWindowByThreadId.get(threadId);
    if (
      activeWindow === undefined ||
      activeWindow.firstAssistantVisibleProgressAtEpochMilliseconds !== null ||
      !hasAssistantVisibleProgress(liveStateSnapshot)
    ) {
      return;
    }

    activeWindow.firstAssistantVisibleProgressAtEpochMilliseconds = atEpochMilliseconds;
    appendSampleWindowValue(
      this.acceptedToFirstAssistantVisibleSamplesMilliseconds,
      clampDurationMilliseconds(atEpochMilliseconds, activeWindow.sendAcceptedAtEpochMilliseconds),
      this.maximumSamplesPerMetric,
    );
    this.activeWindowByThreadId.delete(threadId);
  }

  public readStatistics(): ThreadSendProgressObservabilityStatistics {
    return {
      activeThreadCount: this.activeWindowByThreadId.size,
      inboundSampleCount: this.acceptedToFirstInboundSamplesMilliseconds.length,
      publishedDeltaSampleCount: this.acceptedToFirstPublishedDeltaSamplesMilliseconds.length,
      assistantVisibleSampleCount: this.acceptedToFirstAssistantVisibleSamplesMilliseconds.length,
      lastAcceptedToFirstInboundThreadStreamStateChangedMs: readLastObservedSample(
        this.acceptedToFirstInboundSamplesMilliseconds,
      ),
      p50AcceptedToFirstInboundThreadStreamStateChangedMs: readNearestRankPercentile({
        values: this.acceptedToFirstInboundSamplesMilliseconds,
        percentile: 50,
      }),
      p95AcceptedToFirstInboundThreadStreamStateChangedMs: readNearestRankPercentile({
        values: this.acceptedToFirstInboundSamplesMilliseconds,
        percentile: 95,
      }),
      lastAcceptedToFirstPublishedThreadDeltaMs: readLastObservedSample(
        this.acceptedToFirstPublishedDeltaSamplesMilliseconds,
      ),
      p50AcceptedToFirstPublishedThreadDeltaMs: readNearestRankPercentile({
        values: this.acceptedToFirstPublishedDeltaSamplesMilliseconds,
        percentile: 50,
      }),
      p95AcceptedToFirstPublishedThreadDeltaMs: readNearestRankPercentile({
        values: this.acceptedToFirstPublishedDeltaSamplesMilliseconds,
        percentile: 95,
      }),
      lastAcceptedToFirstAssistantVisibleProgressMs: readLastObservedSample(
        this.acceptedToFirstAssistantVisibleSamplesMilliseconds,
      ),
      p50AcceptedToFirstAssistantVisibleProgressMs: readNearestRankPercentile({
        values: this.acceptedToFirstAssistantVisibleSamplesMilliseconds,
        percentile: 50,
      }),
      p95AcceptedToFirstAssistantVisibleProgressMs: readNearestRankPercentile({
        values: this.acceptedToFirstAssistantVisibleSamplesMilliseconds,
        percentile: 95,
      }),
    };
  }
}

import type { IpcFrame } from "@farfield/protocol";
import type { AgentReadStreamEventsInput, AgentThreadStreamEvents } from "../Types.js";

interface ThreadStreamEventEntry {
  sequence: number;
  frame: IpcFrame;
}

interface ThreadStreamSequenceWindow {
  nextSequence: number;
  firstAvailableSequence: number;
}

export const DEFAULT_STREAM_EVENT_LIMIT = 400;
export const MINIMUM_STREAM_EVENT_LIMIT = 1;
export const STREAM_EVENT_LIMIT_ERROR_MESSAGE =
  "CodexThreadStreamStateOwner streamEventLimit must be a positive integer.";

const INITIAL_STREAM_EVENT_SEQUENCE = 0;
const RESET_CURSOR_SEQUENCE_OFFSET = 1;

/**
 * Owns per-thread stream history retention, event indexing, and cursor-slice semantics.
 * Sequence indexes remain monotonic across retention eviction so downstream owners can
 * localize reduction failures and detect reset-required cursor gaps deterministically.
 */
export class CodexThreadStreamEventHistoryOwner {
  private readonly streamEventEntriesByThreadId = new Map<string, ThreadStreamEventEntry[]>();

  public constructor(private readonly streamEventLimit: number) {
    if (
      !Number.isInteger(this.streamEventLimit) ||
      this.streamEventLimit < MINIMUM_STREAM_EVENT_LIMIT
    ) {
      throw new Error(STREAM_EVENT_LIMIT_ERROR_MESSAGE);
    }
  }

  public appendStreamEvent(threadId: string, frame: IpcFrame): number {
    const currentEntries = this.streamEventEntriesByThreadId.get(threadId) ?? [];
    const sequence = this.readNextSequence(currentEntries);
    currentEntries.push({
      sequence,
      frame,
    });
    if (currentEntries.length > this.streamEventLimit) {
      currentEntries.splice(0, currentEntries.length - this.streamEventLimit);
    }
    this.streamEventEntriesByThreadId.set(threadId, currentEntries);
    return sequence;
  }

  public readStreamEvents(
    threadId: string,
    ownerClientId: string | null,
    input: AgentReadStreamEventsInput,
  ): AgentThreadStreamEvents {
    const threadStreamEntries = this.streamEventEntriesByThreadId.get(threadId) ?? [];
    const sequenceWindow = this.readThreadStreamSequenceWindow(threadStreamEntries);
    const resetRequired = this.isResetRequired(
      input.sinceSequence,
      sequenceWindow.firstAvailableSequence,
      sequenceWindow.nextSequence,
    );
    const selectedEntries = this.selectStreamEntriesForRead(
      threadStreamEntries,
      input,
      resetRequired,
    );
    return {
      ownerClientId,
      events: selectedEntries.map((entry) => entry.frame),
      nextSequence: sequenceWindow.nextSequence,
      firstAvailableSequence: sequenceWindow.firstAvailableSequence,
      resetRequired,
    };
  }

  private readNextSequence(entries: ThreadStreamEventEntry[]): number {
    const lastEntry = entries[entries.length - 1];
    return lastEntry ? lastEntry.sequence + 1 : INITIAL_STREAM_EVENT_SEQUENCE;
  }

  private readThreadStreamSequenceWindow(
    entries: ThreadStreamEventEntry[],
  ): ThreadStreamSequenceWindow {
    const nextSequence = this.readNextSequence(entries);
    const firstEntry = entries[0];
    const firstAvailableSequence = firstEntry ? firstEntry.sequence : nextSequence;
    return {
      nextSequence,
      firstAvailableSequence,
    };
  }

  private isResetRequired(
    sinceSequence: number | null,
    firstAvailableSequence: number,
    nextSequence: number,
  ): boolean {
    // Cursor values represent the last seen event sequence, so subtract one to compare against retained floor.
    if (sinceSequence === null) {
      return false;
    }

    return (
      sinceSequence < firstAvailableSequence - RESET_CURSOR_SEQUENCE_OFFSET ||
      sinceSequence >= nextSequence
    );
  }

  private selectStreamEntriesForRead(
    entries: ThreadStreamEventEntry[],
    input: AgentReadStreamEventsInput,
    resetRequired: boolean,
  ): ThreadStreamEventEntry[] {
    const { sinceSequence, limit } = input;
    if (resetRequired || sinceSequence === null) {
      return entries.slice(-limit);
    }

    return entries.filter((entry) => entry.sequence > sinceSequence).slice(0, limit);
  }
}

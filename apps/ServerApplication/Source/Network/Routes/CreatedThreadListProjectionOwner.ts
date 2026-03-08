import type { AgentId } from "../../Agents/Types.js";
import type { ThreadListItemWithAgentId } from "../ThreadListAggregationCache.js";

export interface CreatedThreadListProjectionStatistics {
  entryCount: number;
  writeCount: number;
  evictionCount: number;
  expirationCount: number;
}

interface CreatedThreadListProjectionRecord {
  item: ThreadListItemWithAgentId;
  rememberedAtEpochMilliseconds: number;
}

export interface CreatedThreadListProjectionOwnerOptions {
  timeToLiveMilliseconds: number;
  maximumEntries: number;
  now?: () => number;
}

interface ReadMatchingCreatedThreadsInput {
  enabledAgentIds: AgentId[];
  archived: boolean;
  cwd: string | null;
}

/**
 * Owns short-lived list/sidebar projection overlays for just-created active threads.
 * This bridges brief adapter list eventual-consistency gaps without widening long-term cache state.
 */
export class CreatedThreadListProjectionOwner {
  private readonly timeToLiveMilliseconds: number;
  private readonly maximumEntries: number;
  private readonly now: () => number;
  private readonly recordByThreadId = new Map<string, CreatedThreadListProjectionRecord>();
  private writeCount = 0;
  private evictionCount = 0;
  private expirationCount = 0;

  public constructor(options: CreatedThreadListProjectionOwnerOptions) {
    if (!Number.isInteger(options.timeToLiveMilliseconds) || options.timeToLiveMilliseconds <= 0) {
      throw new Error(
        "CreatedThreadListProjectionOwner requires positive integer timeToLiveMilliseconds",
      );
    }
    if (!Number.isInteger(options.maximumEntries) || options.maximumEntries <= 0) {
      throw new Error("CreatedThreadListProjectionOwner requires positive integer maximumEntries");
    }
    this.timeToLiveMilliseconds = options.timeToLiveMilliseconds;
    this.maximumEntries = options.maximumEntries;
    this.now = options.now ?? (() => Date.now());
  }

  public rememberThread(item: ThreadListItemWithAgentId): void {
    this.pruneExpiredEntries();
    if (this.recordByThreadId.has(item.id)) {
      this.recordByThreadId.delete(item.id);
    }
    this.recordByThreadId.set(item.id, {
      item: { ...item },
      rememberedAtEpochMilliseconds: this.now(),
    });
    this.writeCount += 1;
    this.evictUntilWithinBounds();
  }

  public forgetThread(threadId: string): void {
    this.recordByThreadId.delete(threadId);
  }

  public readMatchingThreads(input: ReadMatchingCreatedThreadsInput): ThreadListItemWithAgentId[] {
    this.pruneExpiredEntries();
    if (input.archived) {
      return [];
    }

    return [...this.recordByThreadId.values()]
      .map((record) => record.item)
      .filter((item) => input.enabledAgentIds.includes(item.agentId))
      .filter((item) => (input.cwd === null ? true : item.cwd === input.cwd))
      .map((item) => ({ ...item }));
  }

  public readStatistics(): CreatedThreadListProjectionStatistics {
    this.pruneExpiredEntries();
    return {
      entryCount: this.recordByThreadId.size,
      writeCount: this.writeCount,
      evictionCount: this.evictionCount,
      expirationCount: this.expirationCount,
    };
  }

  private pruneExpiredEntries(): void {
    const now = this.now();
    for (const [threadId, record] of this.recordByThreadId.entries()) {
      if (now - record.rememberedAtEpochMilliseconds < this.timeToLiveMilliseconds) {
        continue;
      }
      this.recordByThreadId.delete(threadId);
      this.expirationCount += 1;
    }
  }

  private evictUntilWithinBounds(): void {
    while (this.recordByThreadId.size > this.maximumEntries) {
      const oldestEntry = this.recordByThreadId.keys().next();
      if (oldestEntry.done) {
        return;
      }
      this.recordByThreadId.delete(oldestEntry.value);
      this.evictionCount += 1;
    }
  }
}

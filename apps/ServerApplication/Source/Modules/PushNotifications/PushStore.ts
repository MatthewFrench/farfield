import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  parsePushStateStore,
  type PushSettings,
  type PushStateStore,
  type PushSubscription,
  type StoredPushSubscription
} from "@farfield/protocol";

const PUSH_STATE_STORE_VERSION = 1;
const JSON_INDENT_SPACES = 2;
const LINE_FEED = "\n";
const UTF8_FILE_ENCODING = "utf8";
const TEMP_FILE_EXTENSION = "tmp";
const TEMP_FILE_NAME_SEGMENT_DELIMITER = ".";
const OWNER_READ_WRITE_PERMISSIONS = 0o600;
const WRITE_FILE_OPEN_FLAG = "w";
const READ_FILE_OPEN_FLAG = "r";
const WINDOWS_PLATFORM = "win32";
const PUSH_SUBSCRIPTION_IDENTIFIER_PREFIX = "sub_";
const SUBSCRIPTION_INDEX_RESOLUTION_ERROR_MESSAGE = "Push subscription index resolution failed";
const COMPLETION_WATERMARK_INDEX_RESOLUTION_ERROR_MESSAGE =
  "Push completion watermark index resolution failed";

function buildDefaultState(): PushStateStore {
  return parsePushStateStore({
    version: PUSH_STATE_STORE_VERSION,
    subscriptions: [],
    completionWatermarks: []
  });
}

/**
 * Owns canonical push state persistence and in-memory mutation policy.
 */
export class PushStore {
  private readonly filePath: string;
  private state: PushStateStore;
  /**
   * Serializes persistence work so state-file replacements remain deterministic under concurrent writes.
   * The queue also continues processing after failures to avoid stalling later durable writes.
   */
  private persistQueue: Promise<void>;

  public constructor(filePath: string) {
    this.filePath = path.resolve(filePath);
    this.state = buildDefaultState();
    this.persistQueue = Promise.resolve();
  }

  public load(): void {
    if (!fs.existsSync(this.filePath)) {
      this.state = buildDefaultState();
      return;
    }

    const raw = fs.readFileSync(this.filePath, UTF8_FILE_ENCODING);
    if (raw.trim().length === 0) {
      this.state = buildDefaultState();
      return;
    }

    const parsedJson = JSON.parse(raw);
    this.state = parsePushStateStore(parsedJson);
  }

  public listSubscriptions(): StoredPushSubscription[] {
    return this.state.subscriptions.map((subscription) => ({ ...subscription }));
  }

  public getSubscriptionCount(): number {
    return this.state.subscriptions.length;
  }

  public upsertSubscription(
    subscription: PushSubscription,
    settings: PushSettings
  ): Promise<StoredPushSubscription> {
    const now = new Date().toISOString();
    const existingIndex = this.state.subscriptions.findIndex(
      (candidate) => candidate.subscription.endpoint === subscription.endpoint
    );

    let nextSubscription: StoredPushSubscription;
    if (existingIndex >= 0) {
      const existing = this.state.subscriptions[existingIndex];
      if (!existing) {
        throw new Error(SUBSCRIPTION_INDEX_RESOLUTION_ERROR_MESSAGE);
      }
      nextSubscription = {
        ...existing,
        subscription,
        settings,
        updatedAt: now
      };
      this.state.subscriptions[existingIndex] = nextSubscription;
    } else {
      nextSubscription = {
        id: `${PUSH_SUBSCRIPTION_IDENTIFIER_PREFIX}${randomUUID()}`,
        subscription,
        settings,
        createdAt: now,
        updatedAt: now
      };
      this.state.subscriptions.push(nextSubscription);
    }

    return this.persist().then(() => ({ ...nextSubscription }));
  }

  public async removeSubscriptionByEndpoint(endpoint: string): Promise<boolean> {
    const originalLength = this.state.subscriptions.length;
    this.state.subscriptions = this.state.subscriptions.filter(
      (entry) => entry.subscription.endpoint !== endpoint
    );
    const changed = this.state.subscriptions.length !== originalLength;
    if (changed) {
      await this.persist();
    }
    return changed;
  }

  public getCompletionWatermark(threadId: string): string | null {
    const entry = this.state.completionWatermarks.find((candidate) => candidate.threadId === threadId);
    return entry?.marker ?? null;
  }

  public listCompletionWatermarks(): Array<{ threadId: string; marker: string }> {
    return this.state.completionWatermarks.map((entry) => ({
      threadId: entry.threadId,
      marker: entry.marker
    }));
  }

  public async setCompletionWatermark(threadId: string, marker: string): Promise<boolean> {
    const existingIndex = this.state.completionWatermarks.findIndex(
      (candidate) => candidate.threadId === threadId
    );

    if (existingIndex >= 0) {
      const existing = this.state.completionWatermarks[existingIndex];
      if (!existing) {
        throw new Error(COMPLETION_WATERMARK_INDEX_RESOLUTION_ERROR_MESSAGE);
      }
      if (existing.marker === marker) {
        return false;
      }
      this.state.completionWatermarks[existingIndex] = {
        threadId,
        marker
      };
      await this.persist();
      return true;
    }

    this.state.completionWatermarks.push({
      threadId,
      marker
    });
    await this.persist();
    return true;
  }

  private persist(): Promise<void> {
    // Mutations update in-memory state first, then enqueue asynchronous durable writes.
    // Capturing the encoded snapshot here ensures each queued write matches mutation order.
    const encodedState = `${JSON.stringify(this.state, null, JSON_INDENT_SPACES)}${LINE_FEED}`;
    const runPersistWrite = async (): Promise<void> => {
      await this.persistEncodedState(encodedState);
    };
    const queuedPersist = this.persistQueue.then(runPersistWrite, runPersistWrite);
    this.persistQueue = queuedPersist;
    return queuedPersist;
  }

  private async persistEncodedState(encodedState: string): Promise<void> {
    const directory = path.dirname(this.filePath);
    await fs.promises.mkdir(directory, { recursive: true });

    const tempPath = this.buildTemporaryStatePath();
    const fileHandle = await fs.promises.open(
      tempPath,
      WRITE_FILE_OPEN_FLAG,
      OWNER_READ_WRITE_PERMISSIONS
    );
    try {
      await fileHandle.writeFile(encodedState, UTF8_FILE_ENCODING);
      await fileHandle.sync();
    } finally {
      await fileHandle.close();
    }

    try {
      await fs.promises.rename(tempPath, this.filePath);
    } catch (error) {
      try {
        await fs.promises.unlink(tempPath);
      } catch {
        // no-op
      }
      throw error;
    }

    if (process.platform !== WINDOWS_PLATFORM) {
      const directoryHandle = await fs.promises.open(directory, READ_FILE_OPEN_FLAG);
      try {
        await directoryHandle.sync();
      } finally {
        await directoryHandle.close();
      }
    }
  }

  private buildTemporaryStatePath(): string {
    return [
      this.filePath,
      String(process.pid),
      String(Date.now()),
      TEMP_FILE_EXTENSION
    ].join(TEMP_FILE_NAME_SEGMENT_DELIMITER);
  }
}

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

function buildDefaultState(): PushStateStore {
  return parsePushStateStore({
    version: 1,
    subscriptions: [],
    completionWatermarks: []
  });
}

export class PushStore {
  private readonly filePath: string;
  private state: PushStateStore;
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

    const raw = fs.readFileSync(this.filePath, "utf8");
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
        throw new Error("Push subscription index resolution failed");
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
        id: `sub_${randomUUID()}`,
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
        throw new Error("Push completion watermark index resolution failed");
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
    const encodedState = `${JSON.stringify(this.state, null, 2)}\n`;
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

    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    const fileHandle = await fs.promises.open(tempPath, "w", 0o600);
    try {
      await fileHandle.writeFile(encodedState, "utf8");
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

    if (process.platform !== "win32") {
      const directoryHandle = await fs.promises.open(directory, "r");
      try {
        await directoryHandle.sync();
      } finally {
        await directoryHandle.close();
      }
    }
  }
}

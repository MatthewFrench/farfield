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

  public constructor(filePath: string) {
    this.filePath = path.resolve(filePath);
    this.state = buildDefaultState();
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
  ): StoredPushSubscription {
    const now = new Date().toISOString();
    const existingIndex = this.state.subscriptions.findIndex(
      (candidate) => candidate.subscription.endpoint === subscription.endpoint
    );

    if (existingIndex >= 0) {
      const existing = this.state.subscriptions[existingIndex];
      if (!existing) {
        throw new Error("Push subscription index resolution failed");
      }
      const next: StoredPushSubscription = {
        ...existing,
        subscription,
        settings,
        updatedAt: now
      };
      this.state.subscriptions[existingIndex] = next;
      this.persist();
      return { ...next };
    }

    const created: StoredPushSubscription = {
      id: `sub_${randomUUID()}`,
      subscription,
      settings,
      createdAt: now,
      updatedAt: now
    };
    this.state.subscriptions.push(created);
    this.persist();
    return { ...created };
  }

  public removeSubscriptionByEndpoint(endpoint: string): boolean {
    const originalLength = this.state.subscriptions.length;
    this.state.subscriptions = this.state.subscriptions.filter(
      (entry) => entry.subscription.endpoint !== endpoint
    );
    const changed = this.state.subscriptions.length !== originalLength;
    if (changed) {
      this.persist();
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

  public setCompletionWatermark(threadId: string, marker: string): boolean {
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
      this.persist();
      return true;
    }

    this.state.completionWatermarks.push({
      threadId,
      marker
    });
    this.persist();
    return true;
  }

  private persist(): void {
    const directory = path.dirname(this.filePath);
    fs.mkdirSync(directory, { recursive: true });

    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    const encoded = `${JSON.stringify(this.state, null, 2)}\n`;
    const fd = fs.openSync(tempPath, "w", 0o600);
    try {
      fs.writeFileSync(fd, encoded, "utf8");
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }

    try {
      fs.renameSync(tempPath, this.filePath);
    } catch (error) {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      throw error;
    }

    const dirFd = fs.openSync(directory, "r");
    try {
      fs.fsyncSync(dirFd);
    } finally {
      fs.closeSync(dirFd);
    }
  }
}

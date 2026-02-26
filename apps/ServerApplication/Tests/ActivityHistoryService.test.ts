import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { ActivityHistoryService } from "../Source/Modules/Activity/ActivityHistoryService.js";
import { EventStreamClientRegistry } from "../Source/Network/EventStreamClientRegistry.js";

const temporaryDirectoryPaths: string[] = [];

function createTemporaryDirectory(): string {
  const temporaryDirectoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "farfield-history-service-"));
  temporaryDirectoryPaths.push(temporaryDirectoryPath);
  return temporaryDirectoryPath;
}

afterEach(() => {
  for (const temporaryDirectoryPath of temporaryDirectoryPaths.splice(0)) {
    if (fs.existsSync(temporaryDirectoryPath)) {
      fs.rmSync(temporaryDirectoryPath, { recursive: true, force: true });
    }
  }
});

describe("ActivityHistoryService", () => {
  it("rejects non-positive constructor limits", () => {
    const eventStreamClientRegistry = new EventStreamClientRegistry(1_000);

    expect(() => new ActivityHistoryService(0, eventStreamClientRegistry)).toThrow(
      "ActivityHistoryService requires positive integer historyLimit"
    );
    expect(() => new ActivityHistoryService(4, eventStreamClientRegistry, 0)).toThrow(
      "ActivityHistoryService requires positive integer historyPayloadSummaryMaximumBytes"
    );
  });

  it("enforces bounded history and payload lookup", () => {
    const eventStreamClientRegistry = new EventStreamClientRegistry(1_000);
    const service = new ActivityHistoryService(2, eventStreamClientRegistry);

    const first = service.pushHistory("app", "out", { value: "first" });
    const second = service.pushHistory("app", "out", { value: "second" });
    const third = service.pushHistory("app", "out", { value: "third" });

    const history = service.readHistoryEntries();
    const historyById = service.readHistoryById();

    expect(history).toHaveLength(2);
    expect(history[0]?.id).toBe(second.id);
    expect(history[1]?.id).toBe(third.id);
    expect(historyById.has(first.id)).toBe(false);
    expect(historyById.has(second.id)).toBe(true);
    expect(historyById.has(third.id)).toBe(true);
  });

  it("returns owned snapshots for history maps and trace summaries", async () => {
    const traceDirectoryPath = createTemporaryDirectory();
    const eventStreamClientRegistry = new EventStreamClientRegistry(1_000);
    const service = new ActivityHistoryService(4, eventStreamClientRegistry);

    const entry = service.pushHistory("app", "out", { value: "history" }, { threadId: "thread_1" });
    const firstHistoryByIdSnapshot = service.readHistoryById();
    firstHistoryByIdSnapshot.delete(entry.id);
    expect(service.readHistoryById().has(entry.id)).toBe(true);

    const startedTrace = service.startTrace(traceDirectoryPath, "trace", () => {
      if (!fs.existsSync(traceDirectoryPath)) {
        fs.mkdirSync(traceDirectoryPath, { recursive: true });
      }
    });
    if (!startedTrace) {
      throw new Error("expected trace to start");
    }

    const activeSnapshot = service.readActiveTraceSummary();
    if (!activeSnapshot) {
      throw new Error("expected active trace snapshot");
    }
    activeSnapshot.eventCount = 999;
    expect(service.readActiveTraceSummary()?.eventCount).toBe(0);

    const stoppedTrace = service.stopTrace();
    if (!stoppedTrace) {
      throw new Error("expected trace to stop");
    }

    const traceSnapshot = service.readTraceById(stoppedTrace.id);
    if (!traceSnapshot) {
      throw new Error("expected trace snapshot by id");
    }
    traceSnapshot.label = "mutated";
    expect(service.readTraceById(stoppedTrace.id)?.label).toBe("trace");

    const recentSnapshot = service.readRecentTraces();
    if (!recentSnapshot[0]) {
      throw new Error("expected recent trace snapshot");
    }
    recentSnapshot[0].eventCount = 123;
    expect(service.readRecentTraces()[0]?.eventCount).toBe(0);
    // Allow trace stream close callbacks to flush before temporary directory cleanup.
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 25);
    });
  });

  it("records action failures as action + system history entries", () => {
    const eventStreamClientRegistry = new EventStreamClientRegistry(1_000);
    const service = new ActivityHistoryService(20, eventStreamClientRegistry);

    const errorMessage = service.pushActionFailure("messages", "failed to send", {
      threadId: "thread_1"
    });

    expect(errorMessage).toBe("failed to send");

    const history = service.readHistoryEntries();
    const actionEntry = history[0];
    const systemEntry = history[1];

    expect(history).toHaveLength(2);
    expect(actionEntry?.source).toBe("app");
    expect(actionEntry?.direction).toBe("out");
    expect(systemEntry?.source).toBe("system");
    expect(systemEntry?.direction).toBe("system");
  });

  it("owns trace lifecycle operations and bounded recent trace list", async () => {
    const traceDirectoryPath = createTemporaryDirectory();
    const eventStreamClientRegistry = new EventStreamClientRegistry(1_000);
    const service = new ActivityHistoryService(20, eventStreamClientRegistry);

    const firstTrace = service.startTrace(traceDirectoryPath, "first", () => {
      if (!fs.existsSync(traceDirectoryPath)) {
        fs.mkdirSync(traceDirectoryPath, { recursive: true });
      }
    });
    expect(firstTrace).not.toBeNull();
    if (!firstTrace) {
      throw new Error("expected trace to start");
    }

    expect(service.markTrace("checkpoint")).toBe(true);
    const activeSummary = service.readActiveTraceSummary();
    expect(activeSummary?.id).toBe(firstTrace.id);
    expect(activeSummary?.eventCount).toBe(1);

    const secondStartAttempt = service.startTrace(traceDirectoryPath, "second", () => {});
    expect(secondStartAttempt).toBeNull();

    const stoppedFirstTrace = service.stopTrace();
    expect(stoppedFirstTrace?.id).toBe(firstTrace.id);
    expect(service.readActiveTraceSummary()).toBeNull();
    expect(service.markTrace("after-stop")).toBe(false);

    for (let index = 0; index < 22; index += 1) {
      const summary = service.startTrace(traceDirectoryPath, `trace_${String(index)}`, () => {});
      if (!summary) {
        throw new Error("expected trace to start");
      }
      service.stopTrace();
    }

    expect(service.readRecentTraces().length).toBe(20);
    const latestTrace = service.readRecentTraces()[0];
    expect(latestTrace?.label).toBe("trace_21");
    expect(service.readTraceById(latestTrace?.id ?? "")?.id).toBe(latestTrace?.id);
    // Allow trace stream close callbacks to flush before temporary directory cleanup.
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 25);
    });
  });

  it("summarizes oversized history payloads while preserving full payload lookup", () => {
    const eventStreamClientRegistry = new EventStreamClientRegistry(1_000);
    const service = new ActivityHistoryService(4, eventStreamClientRegistry, 64);
    const oversizedPayload = {
      method: "thread-stream-state-changed",
      value: "x".repeat(2_048)
    };

    const entry = service.pushHistory("ipc", "in", oversizedPayload, {});
    const history = service.readHistoryEntries();
    const payloadFromList = history[0]?.payload;
    const payloadFromLookup = service.readHistoryById().get(entry.id);
    const payloadSummarySchema = z.object({
      type: z.literal("history-payload-summary"),
      truncated: z.literal(true),
      originalSizeBytes: z.number().int().positive(),
      preview: z.string()
    }).strict();
    const parsedPayloadSummary = payloadSummarySchema.parse(payloadFromList);

    expect(parsedPayloadSummary.originalSizeBytes).toBeGreaterThan(64);
    expect(parsedPayloadSummary.preview.length).toBeLessThanOrEqual(64);
    expect(payloadFromLookup).toEqual(oversizedPayload);
  });
});

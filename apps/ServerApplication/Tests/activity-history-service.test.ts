import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ActivityHistoryService } from "../Source/ActivityHistoryService.js";
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

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 25);
    });
  });
});

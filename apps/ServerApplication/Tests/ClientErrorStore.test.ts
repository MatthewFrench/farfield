import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClientErrorStore } from "../Source/Modules/Debugging/ClientErrorStore.js";
import { logger } from "../Source/Shared/Logging/Logger.js";

const tempDirectories: string[] = [];

function makeTempDir(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "farfield-client-error-store-"));
  tempDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    if (fs.existsSync(directory)) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
  vi.restoreAllMocks();
});

describe("ClientErrorStore", () => {
  it("records client and server errors and persists ndjson session log", () => {
    const directory = makeTempDir();
    const logPath = path.join(directory, "session.ndjson");
    const store = new ClientErrorStore(logPath, "session_1", 20);

    const clientEvent = store.recordClientError({
      source: "web-app",
      operation: "push:auto-heal",
      message: "The string did not match the expected pattern.",
      name: "TypeError",
      stack: "TypeError: sample",
      requestId: "req_1",
      threadId: "thread_1",
      url: "/threads/thread_1",
      occurredAt: "2026-02-18T00:00:00.000Z",
      details: {
        tab: "chat"
      }
    });

    const serverEvent = store.recordServerError({
      source: "monitor-server",
      operation: "request-failed",
      message: "Desktop IPC is not connected",
      severity: "error",
      name: "Error",
      stack: "Error: Desktop IPC is not connected",
      requestId: "req_2",
      threadId: "thread_2",
      url: "/api/threads/thread_2/live-state",
      details: {
        method: "GET"
      },
      occurredAt: "2026-02-18T00:00:01.000Z"
    });

    expect(store.getCount()).toBe(2);
    expect(clientEvent.origin).toBe("client");
    expect(serverEvent.origin).toBe("server");

    const raw = fs.readFileSync(logPath, "utf8").trim();
    const lines = raw.split("\n");
    expect(lines.length).toBe(2);
    expect(lines[0]).toContain("\"origin\":\"client\"");
    expect(lines[1]).toContain("\"origin\":\"server\"");

    const reloadedStore = new ClientErrorStore(logPath, "session_1", 20);
    expect(reloadedStore.getCount()).toBe(2);
    expect(reloadedStore.getById(clientEvent.errorId)?.operation).toBe("push:auto-heal");
    expect(reloadedStore.getById(serverEvent.errorId)?.operation).toBe("request-failed");
  });

  it("caps in-memory events and session log file by maxEntries", () => {
    const directory = makeTempDir();
    const logPath = path.join(directory, "session.ndjson");
    const store = new ClientErrorStore(logPath, "session_2", 2);

    store.recordClientError({
      source: "web-app",
      operation: "op-1",
      message: "one",
      details: {}
    });
    store.recordClientError({
      source: "web-app",
      operation: "op-2",
      message: "two",
      details: {}
    });
    store.recordClientError({
      source: "web-app",
      operation: "op-3",
      message: "three",
      details: {}
    });

    expect(store.getCount()).toBe(2);
    const listed = store.list(10);
    expect(listed.map((entry) => entry.operation)).toEqual(["op-2", "op-3"]);

    const raw = fs.readFileSync(logPath, "utf8").trim();
    const lines = raw.split("\n");
    expect(lines.length).toBe(2);
  });

  it("clears stored events and truncates the session log file", () => {
    const directory = makeTempDir();
    const logPath = path.join(directory, "session.ndjson");
    const store = new ClientErrorStore(logPath, "session_2", 2);

    store.recordClientError({
      source: "web-app",
      operation: "op-1",
      message: "one",
      details: {}
    });
    const clearedCount = store.clear();

    expect(clearedCount).toBe(1);
    expect(store.getCount()).toBe(0);
    expect(store.list(10)).toEqual([]);
    expect(fs.readFileSync(logPath, "utf8")).toBe("");
  });

  it("skips malformed ndjson lines while loading existing events", () => {
    const directory = makeTempDir();
    const logPath = path.join(directory, "session.ndjson");
    const warnSpy = vi.spyOn(logger, "warn");
    const validEvent = {
      errorId: "error_valid",
      sessionId: "session_3",
      origin: "client" as const,
      source: "web-app",
      operation: "valid-op",
      message: "valid",
      severity: "error" as const,
      name: null,
      stack: null,
      requestId: null,
      threadId: null,
      url: null,
      details: {},
      occurredAt: "2026-02-18T00:00:00.000Z",
      recordedAt: "2026-02-18T00:00:01.000Z"
    };
    const invalidSchemaEvent = {
      errorId: "error_invalid_schema",
      sessionId: "session_3",
      origin: "invalid-origin",
      source: "monitor-server",
      operation: "invalid",
      message: "invalid",
      details: {},
      occurredAt: "2026-02-18T00:00:00.000Z",
      recordedAt: "2026-02-18T00:00:01.000Z"
    };
    const lines = [
      JSON.stringify(validEvent),
      "{\"errorId\":\"error_truncated\"",
      JSON.stringify(invalidSchemaEvent)
    ];
    fs.writeFileSync(logPath, `${lines.join("\n")}\n`, "utf8");

    const store = new ClientErrorStore(logPath, "session_3", 20);
    expect(store.getCount()).toBe(1);
    expect(store.getById("error_valid")?.operation).toBe("valid-op");
    expect(store.getById("error_invalid_schema")).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toMatchObject({
      sessionId: "session_3",
      logPath,
      malformedLineCount: 2,
      sampledLineNumbers: [2, 3]
    });
    expect(warnSpy.mock.calls[0]?.[1]).toBe("client-error-store-skip-malformed-line");
  });
});

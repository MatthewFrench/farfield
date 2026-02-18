import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ClientErrorStore } from "../src/client-error-store.js";

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

  it("caps in-memory events by maxEntries while preserving log file", () => {
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
    expect(lines.length).toBe(3);
  });
});

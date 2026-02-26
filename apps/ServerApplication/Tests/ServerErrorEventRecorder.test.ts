import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ClientErrorStore } from "../Source/Modules/Debugging/ClientErrorStore.js";
import { ServerErrorEventRecorder } from "../Source/Network/ServerErrorEventRecorder.js";

const temporaryDirectoryPaths: string[] = [];

function createTemporaryDirectory(): string {
  const temporaryDirectoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "farfield-error-recorder-"));
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

describe("ServerErrorEventRecorder", () => {
  it("records server errors through the owned client error store", () => {
    const temporaryDirectoryPath = createTemporaryDirectory();
    const store = new ClientErrorStore(
      path.join(temporaryDirectoryPath, "client-errors.ndjson"),
      "session-test",
      100
    );
    const recorder = new ServerErrorEventRecorder(store, {
      readNowIsoString: () => "2026-02-25T00:00:00.000Z"
    });

    recorder.record({
      source: "farfield-server",
      operation: "http:request",
      message: "Request failed",
      severity: "error",
      name: "Error",
      stack: "stack",
      requestId: "request_1",
      threadId: "thread_1",
      url: "/api/threads",
      details: {
        method: "POST",
        actionId: "action_1",
        actionName: "send-message"
      }
    });

    const entries = store.list(10);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.origin).toBe("server");
    expect(entries[0]?.source).toBe("farfield-server");
    expect(entries[0]?.operation).toBe("http:request");
    expect(entries[0]?.message).toBe("Request failed");
    expect(entries[0]?.severity).toBe("error");
    expect(entries[0]?.requestId).toBe("request_1");
    expect(entries[0]?.threadId).toBe("thread_1");
    expect(entries[0]?.url).toBe("/api/threads");
    expect(entries[0]?.occurredAt).toBe("2026-02-25T00:00:00.000Z");
  });

  it("rejects malformed server error payloads at the owner boundary", () => {
    const temporaryDirectoryPath = createTemporaryDirectory();
    const store = new ClientErrorStore(
      path.join(temporaryDirectoryPath, "client-errors.ndjson"),
      "session-test",
      100
    );
    const recorder = new ServerErrorEventRecorder(store);

    expect(() => {
      recorder.record({
        source: "",
        operation: "http:request",
        message: "Request failed",
        severity: "error",
        name: null,
        stack: null,
        requestId: null,
        threadId: null,
        url: null,
        details: {}
      });
    }).toThrow();
  });
});

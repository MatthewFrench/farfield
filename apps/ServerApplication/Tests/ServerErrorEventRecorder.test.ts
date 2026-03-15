import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClientErrorStore } from "../Source/Modules/Debugging/ClientErrorStore.js";
import {
  ServerErrorEventRecorder,
  type ServerErrorEventRecordInput,
} from "../Source/Network/ServerErrorEventRecorder.js";
import { logger } from "../Source/Shared/Logging/Logger.js";

const temporaryDirectoryPaths: string[] = [];
const CLIENT_ERROR_RECORDED_LOG_EVENT = "client-error-recorded";
const TEST_SESSION_IDENTIFIER = "session-test";
const TEST_MAXIMUM_ENTRY_COUNT = 100;

function createTemporaryDirectory(): string {
  const temporaryDirectoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "farfield-error-recorder-"));
  temporaryDirectoryPaths.push(temporaryDirectoryPath);
  return temporaryDirectoryPath;
}

function createStore(): ClientErrorStore {
  const temporaryDirectoryPath = createTemporaryDirectory();
  return new ClientErrorStore(
    path.join(temporaryDirectoryPath, "client-errors.ndjson"),
    TEST_SESSION_IDENTIFIER,
    TEST_MAXIMUM_ENTRY_COUNT,
  );
}

function createValidRecordInput(): ServerErrorEventRecordInput {
  return {
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
      actionName: "send-message",
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const temporaryDirectoryPath of temporaryDirectoryPaths.splice(0)) {
    if (fs.existsSync(temporaryDirectoryPath)) {
      fs.rmSync(temporaryDirectoryPath, { recursive: true, force: true });
    }
  }
});

describe("ServerErrorEventRecorder", () => {
  it("records server errors through the owned client error store and error logger path", () => {
    const store = createStore();
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => undefined);
    const warningSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    const recorder = new ServerErrorEventRecorder(store, {
      readNowIsoString: () => "2026-02-25T00:00:00.000Z",
    });

    recorder.record(createValidRecordInput());

    const entries = store.list(10);
    expect(entries).toHaveLength(1);
    const recordedEntry = entries[0];
    if (!recordedEntry) {
      throw new Error("Expected recorded entry");
    }
    expect(recordedEntry.origin).toBe("server");
    expect(recordedEntry.source).toBe("farfield-server");
    expect(recordedEntry.operation).toBe("http:request");
    expect(recordedEntry.message).toBe("Request failed");
    expect(recordedEntry.severity).toBe("error");
    expect(recordedEntry.requestId).toBe("request_1");
    expect(recordedEntry.threadId).toBe("thread_1");
    expect(recordedEntry.url).toBe("/api/threads");
    expect(recordedEntry.occurredAt).toBe("2026-02-25T00:00:00.000Z");

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(warningSpy).not.toHaveBeenCalled();
    expect(errorSpy.mock.calls[0]?.[0]).toEqual({
      errorId: recordedEntry.errorId,
      origin: "server",
      severity: "error",
      source: "farfield-server",
      operation: "http:request",
      requestId: "request_1",
      threadId: "thread_1",
      message: "Request failed",
    });
    expect(errorSpy.mock.calls[0]?.[1]).toBe(CLIENT_ERROR_RECORDED_LOG_EVENT);
  });

  it("routes warning severity records through warning logger path", () => {
    const store = createStore();
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => undefined);
    const warningSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    const recorder = new ServerErrorEventRecorder(store, {
      readNowIsoString: () => "2026-02-25T01:00:00.000Z",
    });

    recorder.record({
      ...createValidRecordInput(),
      operation: "http:request:validation",
      message: "Validation failed",
      severity: "warning",
    });

    const entries = store.list(10);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.severity).toBe("warning");
    expect(entries[0]?.occurredAt).toBe("2026-02-25T01:00:00.000Z");
    expect(warningSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warningSpy.mock.calls[0]?.[0]).toMatchObject({
      origin: "server",
      severity: "warning",
      source: "farfield-server",
      operation: "http:request:validation",
      requestId: "request_1",
      threadId: "thread_1",
      message: "Validation failed",
    });
    expect(warningSpy.mock.calls[0]?.[1]).toBe(CLIENT_ERROR_RECORDED_LOG_EVENT);
  });

  it("uses deterministic occurredAt values from the injected clock dependency", () => {
    const store = createStore();
    vi.spyOn(logger, "error").mockImplementation(() => undefined);
    vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    const occurredAtValues = ["2026-02-25T02:00:00.000Z", "2026-02-25T02:00:01.000Z"];
    let occurredAtReadCount = 0;
    const recorder = new ServerErrorEventRecorder(store, {
      readNowIsoString: () => {
        const occurredAt = occurredAtValues[occurredAtReadCount];
        if (!occurredAt) {
          throw new Error("Missing test occurredAt value");
        }
        occurredAtReadCount += 1;
        return occurredAt;
      },
    });

    recorder.record(createValidRecordInput());
    recorder.record({
      ...createValidRecordInput(),
      operation: "http:request:retry",
      message: "Retry failed",
      requestId: "request_2",
    });

    expect(store.list(10).map((entry) => entry.occurredAt)).toEqual(occurredAtValues);
    expect(occurredAtReadCount).toBe(2);
  });

  it("rejects malformed server error payloads at the owner boundary", () => {
    const store = createStore();
    const recorder = new ServerErrorEventRecorder(store);

    expect(() => {
      recorder.record({
        ...createValidRecordInput(),
        source: "",
      });
    }).toThrowError(/source/);
    expect(store.list(10)).toHaveLength(0);
  });

  it("rejects malformed occurredAt values from clock dependency before persistence and logging", () => {
    const store = createStore();
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => undefined);
    const warningSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    const recorder = new ServerErrorEventRecorder(store, {
      readNowIsoString: () => "invalid-timestamp",
    });

    expect(() => {
      recorder.record(createValidRecordInput());
    }).toThrowError(/datetime/);
    expect(store.list(10)).toHaveLength(0);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warningSpy).not.toHaveBeenCalled();
  });
});

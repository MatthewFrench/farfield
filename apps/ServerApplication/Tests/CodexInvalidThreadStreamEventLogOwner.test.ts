import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { type IpcFrame } from "@farfield/protocol";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { CodexInvalidThreadStreamEventLogOwner } from "../Source/Agents/Adapters/CodexInvalidThreadStreamEventLogOwner.js";
import { logger } from "../Source/Shared/Logging/Logger.js";

const InvalidThreadStreamEventDetailSchema = z
  .object({
    threadId: z.string().nullable(),
    error: z.string(),
    rawPayload: z
      .object({
        method: z.string(),
      })
      .passthrough(),
    loggedAt: z.string(),
  })
  .passthrough();

describe("CodexInvalidThreadStreamEventLogOwner", () => {
  it("creates parent directories and writes malformed frame details", () => {
    const temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), "farfield-invalid-stream-log-"),
    );
    const invalidStreamEventsLogPath = path.join(
      temporaryDirectory,
      "nested",
      "logs",
      "invalid-stream-events.ndjson",
    );

    const owner = new CodexInvalidThreadStreamEventLogOwner(invalidStreamEventsLogPath);
    const malformedRequestFrame: IpcFrame = {
      type: "request",
      requestId: "request-1",
      method: "thread-read",
      params: {
        conversationId: " thread-1 ",
      },
    };
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => logger);

    try {
      owner.recordInvalidThreadStreamEvent(malformedRequestFrame, "malformed frame");

      expect(fs.existsSync(invalidStreamEventsLogPath)).toBe(true);
      const lines = fs.readFileSync(invalidStreamEventsLogPath, "utf8").trim().split("\n");
      expect(lines.length).toBe(1);
      const parsedDetail = InvalidThreadStreamEventDetailSchema.parse(JSON.parse(lines[0] ?? "{}"));

      expect(parsedDetail.threadId).toBe("thread-1");
      expect(parsedDetail.error).toBe("malformed frame");
      expect(parsedDetail.rawPayload.method).toBe("thread-read");
      expect(warnSpy).toHaveBeenCalledTimes(1);

      const [logSummary, logMessage] = warnSpy.mock.calls[0] ?? [];
      const parsedLogSummary = z
        .object({
          threadId: z.string().nullable(),
          method: z.string(),
          error: z.string(),
          rawPayloadByteCount: z.number().int().positive(),
          loggedAt: z.string(),
        })
        .passthrough()
        .parse(logSummary);
      expect(logMessage).toBe("codex-invalid-thread-stream-event-detail");
      expect(parsedLogSummary.threadId).toBe("thread-1");
      expect(parsedLogSummary.method).toBe("thread-read");
      expect(parsedLogSummary.error).toBe("malformed frame");
      expect("rawPayload" in parsedLogSummary).toBe(false);
    } finally {
      warnSpy.mockRestore();
    }
  });
});

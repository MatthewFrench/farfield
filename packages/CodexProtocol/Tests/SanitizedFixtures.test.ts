import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  JsonValueSchema,
  parseIpcFrame,
  parseThreadStreamStateChangedBroadcast,
  ThreadStreamStateChangedEventType,
} from "../Source/Index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixtureDir = path.join(__dirname, "fixtures", "sanitized");

const bannedPatterns = [/\/Users\//i, /anshu/i, /OpenRLM/i, /codextemp/i];
const FixtureLineSchema = z
  .object({
    type: z.string().min(1),
  })
  .passthrough();
const HistoryLineSchema = z
  .object({
    type: z.literal("history"),
    source: z.string().optional(),
    payload: JsonValueSchema,
  })
  .passthrough();

describe("sanitized fixtures", () => {
  it("contain no sensitive strings and keep valid protocol structure", () => {
    const files = fs.readdirSync(fixtureDir).filter((name) => name.endsWith(".ndjson"));
    expect(files.length).toBeGreaterThan(0);

    let parsedIpcHistoryEntryCount = 0;
    let parsedThreadStreamBroadcastCount = 0;

    for (const fileName of files) {
      const input = fs.readFileSync(path.join(fixtureDir, fileName), "utf8");
      const lines = input.split("\n").filter(Boolean);
      expect(lines.length).toBeGreaterThan(0);

      for (const line of lines) {
        const parsedLine = JsonValueSchema.parse(JSON.parse(line));
        const serialized = JSON.stringify(parsedLine);

        for (const pattern of bannedPatterns) {
          expect(serialized).not.toMatch(pattern);
        }

        const fixtureLine = FixtureLineSchema.parse(parsedLine);
        if (fixtureLine.type !== "history") {
          continue;
        }

        const historyLine = HistoryLineSchema.parse(parsedLine);
        if (historyLine.source !== "ipc") {
          continue;
        }

        const frame = parseIpcFrame(historyLine.payload);
        parsedIpcHistoryEntryCount += 1;

        if (frame.type === "broadcast" && frame.method === ThreadStreamStateChangedEventType) {
          parseThreadStreamStateChangedBroadcast(historyLine.payload);
          parsedThreadStreamBroadcastCount += 1;
        }
      }
    }

    expect(parsedIpcHistoryEntryCount).toBeGreaterThan(0);
    expect(parsedThreadStreamBroadcastCount).toBeGreaterThan(0);
  });
});

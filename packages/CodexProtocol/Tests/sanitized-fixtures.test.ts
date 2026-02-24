import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  IpcFrameSchema,
  JsonValueSchema,
  parseIpcFrame,
  parseThreadStreamStateChangedBroadcast,
  type JsonValue
} from "../Source/Index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixtureDir = path.join(__dirname, "fixtures", "sanitized");

const bannedPatterns = [/\/Users\//i, /anshu/i, /OpenRLM/i, /codextemp/i];
const HistoryLineSchema = z
  .object({
    type: z.string(),
    payload: JsonValueSchema.optional()
  })
  .passthrough();

describe("sanitized fixtures", () => {
  it("contain no sensitive strings and keep valid protocol structure", () => {
    const files = fs.readdirSync(fixtureDir).filter((name) => name.endsWith(".ndjson"));
    expect(files.length).toBeGreaterThan(0);

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

        const historyLine = HistoryLineSchema.safeParse(parsedLine);
        if (!historyLine.success || historyLine.data.type !== "history") {
          continue;
        }

        const payload: JsonValue | undefined = historyLine.data.payload;
        if (payload === undefined) {
          continue;
        }

        const parsedFrame = IpcFrameSchema.safeParse(payload);
        if (!parsedFrame.success) {
          continue;
        }

        const frame = parseIpcFrame(payload);

        if (frame.type === "broadcast" && frame.method === "thread-stream-state-changed") {
          parseThreadStreamStateChangedBroadcast(payload);
        }
      }
    }
  });
});

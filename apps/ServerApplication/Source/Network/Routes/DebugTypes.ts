import fs from "node:fs";
import type { JsonValue } from "@farfield/protocol";

export interface HistoryEntry {
  id: string;
  at: string;
  source: "ipc" | "app" | "system";
  direction: "in" | "out" | "system";
  payload: JsonValue;
  meta: Record<string, JsonValue>;
}

export interface TraceSummary {
  id: string;
  label: string;
  startedAt: string;
  stoppedAt: string | null;
  eventCount: number;
  path: string;
}

export interface ActiveTrace {
  summary: TraceSummary;
  stream: fs.WriteStream;
}

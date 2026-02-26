import fs from "node:fs";
import type { JsonValue } from "@farfield/protocol";

export const HistoryEntrySourceByName = {
  ipc: "ipc",
  app: "app",
  system: "system"
} as const;

export type HistoryEntrySource =
  typeof HistoryEntrySourceByName[keyof typeof HistoryEntrySourceByName];

export const HistoryEntryDirectionByName = {
  in: "in",
  out: "out",
  system: "system"
} as const;

export type HistoryEntryDirection =
  typeof HistoryEntryDirectionByName[keyof typeof HistoryEntryDirectionByName];

export interface HistoryEntry {
  id: string;
  at: string;
  source: HistoryEntrySource;
  direction: HistoryEntryDirection;
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

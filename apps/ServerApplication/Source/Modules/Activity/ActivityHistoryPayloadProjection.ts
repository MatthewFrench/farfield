import type { HistoryEntry } from "../../Network/DebugContracts.js";

const HISTORY_PAYLOAD_SUMMARY_TYPE = "history-payload-summary";
const HISTORY_PAYLOAD_PREVIEW_MAXIMUM_BYTES = 4_096;

const ACTION_DETAIL_SUMMARY_KEYS = [
  "agentId",
  "threadId",
  "ownerClientId",
  "requestId",
  "textLength",
  "cwd",
  "model",
] as const;

/**
 * Owns activity payload/detail projection policies so history retention remains bounded
 * while preserving high-signal action metadata and full payload lookup in store owners.
 */
export function summarizeActionDetails(details: HistoryEntry["meta"]): HistoryEntry["meta"] {
  const summary: HistoryEntry["meta"] = {};
  for (const key of ACTION_DETAIL_SUMMARY_KEYS) {
    const value = details[key];
    if (value !== undefined) {
      summary[key] = value;
    }
  }

  return summary;
}

export function summarizePayloadForHistory(
  payload: HistoryEntry["payload"],
  historyPayloadSummaryMaximumBytes: number,
): HistoryEntry["payload"] {
  const serializedPayload = JSON.stringify(payload);
  const serializedPayloadBytes = Buffer.byteLength(serializedPayload, "utf8");
  if (serializedPayloadBytes <= historyPayloadSummaryMaximumBytes) {
    return payload;
  }

  // Keep preview size bounded so activity history remains responsive under very large payloads.
  const previewMaximumBytes = Math.min(
    HISTORY_PAYLOAD_PREVIEW_MAXIMUM_BYTES,
    historyPayloadSummaryMaximumBytes,
  );
  const preview = serializedPayload.slice(0, previewMaximumBytes);
  return {
    type: HISTORY_PAYLOAD_SUMMARY_TYPE,
    truncated: true,
    originalSizeBytes: serializedPayloadBytes,
    preview,
  };
}

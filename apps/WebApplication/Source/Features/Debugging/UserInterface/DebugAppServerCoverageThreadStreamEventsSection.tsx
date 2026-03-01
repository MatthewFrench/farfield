import { useState } from "react";
import { Button } from "@/Components/UserInterface/Button";
import {
  type DebugAppServerCoverageThreadStreamEventFrameType,
  type DebugAppServerCoverageThreadStreamEventsResult,
} from "../DomainModel/DebugAppServerCoverageContracts";

export interface DebugAppServerCoverageThreadStreamEventsSectionProps {
  isRunningCoverageAction: boolean;
  lastThreadStreamEventsResult: DebugAppServerCoverageThreadStreamEventsResult | null;
  onReadThreadStreamEvents: (threadId: string, sinceSequence?: number | null) => void;
}

const ALL_FRAME_TYPES_FILTER_VALUE = "all";

interface StreamMethodFilterPreset {
  testIdentifierSuffix: string;
  label: string;
  methodQuery: string;
  frameType: DebugAppServerCoverageThreadStreamEventFrameType | typeof ALL_FRAME_TYPES_FILTER_VALUE;
}

const STREAM_METHOD_FILTER_PRESETS: readonly StreamMethodFilterPreset[] = [
  {
    testIdentifierSuffix: "turn-notifications",
    label: "Turn Notifications",
    methodQuery: "turn/",
    frameType: "broadcast",
  },
  {
    testIdentifierSuffix: "thread-notifications",
    label: "Thread Notifications",
    methodQuery: "thread/",
    frameType: "broadcast",
  },
  {
    testIdentifierSuffix: "item-notifications",
    label: "Item Notifications",
    methodQuery: "item/",
    frameType: "broadcast",
  },
  {
    testIdentifierSuffix: "approval-requests",
    label: "Approval Requests",
    methodQuery: "requestApproval",
    frameType: "request",
  },
  {
    testIdentifierSuffix: "account-events",
    label: "Account Events",
    methodQuery: "account/",
    frameType: "broadcast",
  },
];

function parseFrameTypeFilterValue(
  value: string,
  availableFrameTypes: readonly DebugAppServerCoverageThreadStreamEventFrameType[],
): DebugAppServerCoverageThreadStreamEventFrameType | typeof ALL_FRAME_TYPES_FILTER_VALUE {
  if (value === ALL_FRAME_TYPES_FILTER_VALUE) {
    return ALL_FRAME_TYPES_FILTER_VALUE;
  }
  if (availableFrameTypes.includes(value as DebugAppServerCoverageThreadStreamEventFrameType)) {
    return value as DebugAppServerCoverageThreadStreamEventFrameType;
  }
  return ALL_FRAME_TYPES_FILTER_VALUE;
}

/**
 * Owns thread stream-event diagnostics controls for app-server coverage verification.
 * Operators use this to inspect frame-level event batches and cursor behavior.
 */
export function DebugAppServerCoverageThreadStreamEventsSection({
  isRunningCoverageAction,
  lastThreadStreamEventsResult,
  onReadThreadStreamEvents,
}: DebugAppServerCoverageThreadStreamEventsSectionProps): React.JSX.Element {
  const [threadIdDraft, setThreadIdDraft] = useState("");
  const [sinceSequenceDraft, setSinceSequenceDraft] = useState("");
  const [methodFilterDraft, setMethodFilterDraft] = useState("");
  const [frameTypeFilterDraft, setFrameTypeFilterDraft] = useState<
    DebugAppServerCoverageThreadStreamEventFrameType | typeof ALL_FRAME_TYPES_FILTER_VALUE
  >(ALL_FRAME_TYPES_FILTER_VALUE);
  const [copyStatusMessage, setCopyStatusMessage] = useState<string | null>(null);
  const normalizedMethodFilter = methodFilterDraft.trim().toLowerCase();
  const isFrameTypeFilterActive = frameTypeFilterDraft !== ALL_FRAME_TYPES_FILTER_VALUE;

  const runThreadStreamEventsRead = (): void => {
    const normalizedThreadIdentifier = threadIdDraft.trim();
    if (normalizedThreadIdentifier.length === 0) {
      return;
    }

    const normalizedSinceSequence = sinceSequenceDraft.trim();
    if (normalizedSinceSequence.length === 0) {
      onReadThreadStreamEvents(normalizedThreadIdentifier, null);
      return;
    }

    const parsedSinceSequence = Number(normalizedSinceSequence);
    if (!Number.isInteger(parsedSinceSequence) || parsedSinceSequence < 0) {
      return;
    }

    onReadThreadStreamEvents(normalizedThreadIdentifier, parsedSinceSequence);
  };

  const filteredEvents =
    lastThreadStreamEventsResult === null
      ? []
      : lastThreadStreamEventsResult.events.filter((event) => {
          if (normalizedMethodFilter.length === 0) {
            return !isFrameTypeFilterActive || event.frameType === frameTypeFilterDraft;
          }
          const matchesMethod = (event.method ?? "").toLowerCase().includes(normalizedMethodFilter);
          const matchesFrameType =
            !isFrameTypeFilterActive || event.frameType === frameTypeFilterDraft;
          return matchesMethod && matchesFrameType;
        });
  const availableFrameTypes =
    lastThreadStreamEventsResult === null
      ? []
      : [...new Set(lastThreadStreamEventsResult.events.map((event) => event.frameType))].sort();

  const copyFilteredEventsAsJson = async (): Promise<void> => {
    if (lastThreadStreamEventsResult === null) {
      return;
    }
    const clipboard = navigator.clipboard;
    if (!clipboard || typeof clipboard.writeText !== "function") {
      setCopyStatusMessage("Clipboard write is unavailable in this environment.");
      return;
    }

    const payload = {
      threadId: lastThreadStreamEventsResult.threadId,
      sinceSequence: lastThreadStreamEventsResult.sinceSequence,
      nextSequence: lastThreadStreamEventsResult.nextSequence,
      firstAvailableSequence: lastThreadStreamEventsResult.firstAvailableSequence,
      resetRequired: lastThreadStreamEventsResult.resetRequired,
      methodFilter: normalizedMethodFilter.length === 0 ? null : methodFilterDraft,
      frameTypeFilter:
        frameTypeFilterDraft === ALL_FRAME_TYPES_FILTER_VALUE ? null : frameTypeFilterDraft,
      filteredEventCount: filteredEvents.length,
      events: filteredEvents,
    };

    try {
      await clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopyStatusMessage(
        filteredEvents.length === 1
          ? "Copied 1 filtered event."
          : `Copied ${String(filteredEvents.length)} filtered events.`,
      );
    } catch {
      setCopyStatusMessage("Failed to copy filtered events.");
    }
  };

  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Thread Stream Events
        </h4>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="debug-coverage-thread-stream-read-next-cursor"
            disabled={isRunningCoverageAction || lastThreadStreamEventsResult === null}
            onClick={() => {
              if (lastThreadStreamEventsResult === null) {
                return;
              }

              onReadThreadStreamEvents(
                lastThreadStreamEventsResult.threadId,
                lastThreadStreamEventsResult.nextSequence,
              );
            }}
          >
            Read From Next Cursor
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="debug-coverage-thread-stream-read"
            disabled={isRunningCoverageAction}
            onClick={runThreadStreamEventsRead}
          >
            Read Stream Events
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground" htmlFor="debug-coverage-thread-stream-id">
          Thread Id
        </label>
        <input
          id="debug-coverage-thread-stream-id"
          data-testid="debug-coverage-thread-stream-thread-id"
          type="text"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
          value={threadIdDraft}
          onChange={(event) => {
            setThreadIdDraft(event.target.value);
          }}
          placeholder="thread-123"
        />
        <label
          className="text-xs text-muted-foreground"
          htmlFor="debug-coverage-thread-stream-since-sequence"
        >
          Since sequence (optional)
        </label>
        <input
          id="debug-coverage-thread-stream-since-sequence"
          data-testid="debug-coverage-thread-stream-since-sequence"
          type="text"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
          value={sinceSequenceDraft}
          onChange={(event) => {
            setSinceSequenceDraft(event.target.value);
          }}
          placeholder="0"
        />
      </div>
      {lastThreadStreamEventsResult === null ? (
        <p className="text-xs text-muted-foreground">No stream-event diagnostics captured.</p>
      ) : (
        <div
          className="rounded border border-border/70 p-2 text-xs space-y-2"
          data-testid="debug-coverage-thread-stream-result"
        >
          <p>
            Thread: <span className="font-mono">{lastThreadStreamEventsResult.threadId}</span>
          </p>
          <p>Owner: {lastThreadStreamEventsResult.ownerClientId ?? "None"}</p>
          <p>Events returned: {lastThreadStreamEventsResult.eventCount}</p>
          <p>
            Cursor: next={String(lastThreadStreamEventsResult.nextSequence)} • firstAvailable=
            {String(lastThreadStreamEventsResult.firstAvailableSequence)} • resetRequired=
            {lastThreadStreamEventsResult.resetRequired ? "true" : "false"}
          </p>
          {lastThreadStreamEventsResult.resetRequired ? (
            <div
              className="rounded border border-amber-400/60 bg-amber-50/40 p-2 text-xs space-y-2"
              data-testid="debug-coverage-thread-stream-reset-required"
            >
              <p>
                Returned cursor indicates a dropped range. Read without a since-sequence cursor to
                resynchronize.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="debug-coverage-thread-stream-read-reset"
                disabled={isRunningCoverageAction}
                onClick={() => {
                  onReadThreadStreamEvents(lastThreadStreamEventsResult.threadId, null);
                }}
              >
                Read Without Cursor
              </Button>
            </div>
          ) : null}
          <p>
            Since sequence used:{" "}
            {lastThreadStreamEventsResult.sinceSequence === null
              ? "none"
              : String(lastThreadStreamEventsResult.sinceSequence)}
          </p>
          <p>
            Read at: {new Date(lastThreadStreamEventsResult.readAtIso8601).toLocaleTimeString()}
          </p>
          <div className="space-y-2">
            <label
              className="text-xs text-muted-foreground"
              htmlFor="debug-coverage-thread-stream-method-filter"
            >
              Method filter (optional)
            </label>
            <div className="flex flex-wrap gap-2">
              {STREAM_METHOD_FILTER_PRESETS.map((preset) => (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  key={preset.testIdentifierSuffix}
                  data-testid={`debug-coverage-thread-stream-method-preset-${preset.testIdentifierSuffix}`}
                  disabled={isRunningCoverageAction}
                  onClick={() => {
                    setMethodFilterDraft(preset.methodQuery);
                    setFrameTypeFilterDraft(preset.frameType);
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                id="debug-coverage-thread-stream-method-filter"
                data-testid="debug-coverage-thread-stream-method-filter"
                type="text"
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                value={methodFilterDraft}
                onChange={(event) => {
                  setMethodFilterDraft(event.target.value);
                }}
                placeholder="turn/completed"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="debug-coverage-thread-stream-method-filter-clear"
                disabled={
                  methodFilterDraft.length === 0 &&
                  frameTypeFilterDraft === ALL_FRAME_TYPES_FILTER_VALUE
                }
                onClick={() => {
                  setMethodFilterDraft("");
                  setFrameTypeFilterDraft(ALL_FRAME_TYPES_FILTER_VALUE);
                }}
              >
                Clear
              </Button>
            </div>
            <label
              className="text-xs text-muted-foreground"
              htmlFor="debug-coverage-thread-stream-frame-type-filter"
            >
              Frame type filter (optional)
            </label>
            <select
              id="debug-coverage-thread-stream-frame-type-filter"
              data-testid="debug-coverage-thread-stream-frame-type-filter"
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
              value={frameTypeFilterDraft}
              onChange={(event) => {
                setFrameTypeFilterDraft(
                  parseFrameTypeFilterValue(event.target.value, availableFrameTypes),
                );
              }}
            >
              <option value={ALL_FRAME_TYPES_FILTER_VALUE}>All frame types</option>
              {availableFrameTypes.map((frameType) => (
                <option key={frameType} value={frameType}>
                  {frameType}
                </option>
              ))}
            </select>
          </div>
          {lastThreadStreamEventsResult.methodCounts.length === 0 ? (
            <p className="text-xs text-muted-foreground">Method counts: none captured.</p>
          ) : (
            <div className="space-y-1">
              <p>Method counts:</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-testid="debug-coverage-thread-stream-method-count-all"
                  disabled={methodFilterDraft.length === 0}
                  onClick={() => {
                    setMethodFilterDraft("");
                  }}
                >
                  All
                </Button>
                {lastThreadStreamEventsResult.methodCounts.map((methodCount) => (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    key={methodCount.method}
                    data-testid={`debug-coverage-thread-stream-method-count-${methodCount.method}`}
                    disabled={isRunningCoverageAction}
                    onClick={() => {
                      setMethodFilterDraft(methodCount.method);
                    }}
                  >
                    {methodCount.method}: {String(methodCount.count)}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {normalizedMethodFilter.length > 0 ? (
            <p data-testid="debug-coverage-thread-stream-filter-summary">
              Filtered events: {String(filteredEvents.length)} of{" "}
              {String(lastThreadStreamEventsResult.events.length)}
            </p>
          ) : isFrameTypeFilterActive ? (
            <p data-testid="debug-coverage-thread-stream-filter-summary">
              Filtered events: {String(filteredEvents.length)} of{" "}
              {String(lastThreadStreamEventsResult.events.length)}
            </p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="debug-coverage-thread-stream-copy-filtered-json"
            onClick={() => {
              void copyFilteredEventsAsJson();
            }}
          >
            Copy Filtered JSON
          </Button>
          {copyStatusMessage === null ? null : (
            <p
              className="text-xs text-muted-foreground"
              data-testid="debug-coverage-thread-stream-copy-status"
            >
              {copyStatusMessage}
            </p>
          )}
          {filteredEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {lastThreadStreamEventsResult.events.length === 0 ||
              normalizedMethodFilter.length === 0
                ? "No frames in the returned stream batch."
                : "No frames match the current method filter."}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredEvents.map((event, eventIndex) => (
                <div
                  key={`${event.frameType}-${eventIndex}`}
                  data-testid={`debug-coverage-thread-stream-event-${String(eventIndex)}`}
                  className="rounded border border-border/60 p-2 space-y-1"
                >
                  <p>
                    {event.frameType} • {event.method ?? "(no method)"}
                  </p>
                  <p>
                    requestId={event.requestId ?? "none"} • sourceClientId=
                    {event.sourceClientId ?? "none"} • sequence=
                    {event.sequence === null ? "none" : String(event.sequence)}
                  </p>
                  <p>
                    receivedAtMilliseconds=
                    {event.receivedAtMilliseconds === null
                      ? "none"
                      : String(event.receivedAtMilliseconds)}
                  </p>
                  <pre className="rounded border border-border/60 bg-background p-2 whitespace-pre-wrap break-words">
                    {event.preview}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

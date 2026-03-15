import { useState } from "react";
import { Button } from "@/Components/UserInterface/Button";
import { type DebugAppServerCoverageServerRequestResolvedEventsResult } from "../DomainModel/DebugAppServerCoverageContracts";

export interface DebugAppServerCoverageServerRequestResolvedEventsSectionProps {
  isRunningCoverageAction: boolean;
  lastServerRequestResolvedEventsResult: DebugAppServerCoverageServerRequestResolvedEventsResult | null;
  onReadServerRequestResolvedEvents: (sinceSequence?: number | null) => void;
  onReadPendingServerRequests: () => void;
}

/**
 * Owns diagnostics for serverRequest/resolved notification visibility.
 * Operators can verify completion signals and immediately refresh pending-request snapshots.
 */
export function DebugAppServerCoverageServerRequestResolvedEventsSection({
  isRunningCoverageAction,
  lastServerRequestResolvedEventsResult,
  onReadServerRequestResolvedEvents,
  onReadPendingServerRequests,
}: DebugAppServerCoverageServerRequestResolvedEventsSectionProps): React.JSX.Element {
  const [sinceSequenceDraft, setSinceSequenceDraft] = useState("");
  const [threadFilterDraft, setThreadFilterDraft] = useState("");
  const normalizedThreadFilter = threadFilterDraft.trim().toLowerCase();

  const runServerRequestResolvedEventsRead = (): void => {
    const normalizedSinceSequence = sinceSequenceDraft.trim();
    if (normalizedSinceSequence.length === 0) {
      onReadServerRequestResolvedEvents(null);
      return;
    }

    const parsedSinceSequence = Number(normalizedSinceSequence);
    if (!Number.isInteger(parsedSinceSequence) || parsedSinceSequence < 0) {
      return;
    }

    onReadServerRequestResolvedEvents(parsedSinceSequence);
  };

  const filteredEvents =
    lastServerRequestResolvedEventsResult === null
      ? []
      : lastServerRequestResolvedEventsResult.events.filter((event) =>
          event.threadId.toLowerCase().includes(normalizedThreadFilter),
        );

  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Server-Request Resolved Events
        </h4>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="debug-coverage-server-request-resolved-events-read-next-cursor"
            disabled={isRunningCoverageAction || lastServerRequestResolvedEventsResult === null}
            onClick={() => {
              if (lastServerRequestResolvedEventsResult === null) {
                return;
              }
              onReadServerRequestResolvedEvents(lastServerRequestResolvedEventsResult.nextSequence);
            }}
          >
            Read From Next Cursor
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="debug-coverage-server-request-resolved-events-read"
            disabled={isRunningCoverageAction}
            onClick={runServerRequestResolvedEventsRead}
          >
            Read Resolved Events
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="debug-coverage-server-request-resolved-events-refresh-pending"
            disabled={isRunningCoverageAction}
            onClick={onReadPendingServerRequests}
          >
            Refresh Pending
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <label
          className="text-xs text-muted-foreground"
          htmlFor="debug-coverage-server-request-resolved-events-since-sequence"
        >
          Since sequence (optional)
        </label>
        <input
          id="debug-coverage-server-request-resolved-events-since-sequence"
          data-testid="debug-coverage-server-request-resolved-events-since-sequence"
          type="text"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
          value={sinceSequenceDraft}
          onChange={(event) => {
            setSinceSequenceDraft(event.target.value);
          }}
          placeholder="0"
        />
      </div>
      {lastServerRequestResolvedEventsResult === null ? (
        <p className="text-xs text-muted-foreground">
          No server-request resolved diagnostics captured.
        </p>
      ) : (
        <div
          className="rounded border border-border/70 p-2 text-xs space-y-2"
          data-testid="debug-coverage-server-request-resolved-events-result"
        >
          <p>Resolved events returned: {lastServerRequestResolvedEventsResult.eventCount}</p>
          <p>
            Cursor: next={String(lastServerRequestResolvedEventsResult.nextSequence)} •
            firstAvailable={String(lastServerRequestResolvedEventsResult.firstAvailableSequence)} •
            resetRequired={lastServerRequestResolvedEventsResult.resetRequired ? "true" : "false"}
          </p>
          {lastServerRequestResolvedEventsResult.resetRequired ? (
            <div className="rounded border border-amber-400/60 bg-amber-50/40 p-2 text-xs space-y-2">
              <p>Cursor indicates a dropped range. Read without since-sequence to resync.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="debug-coverage-server-request-resolved-events-read-reset"
                disabled={isRunningCoverageAction}
                onClick={() => {
                  onReadServerRequestResolvedEvents(null);
                }}
              >
                Read Without Cursor
              </Button>
            </div>
          ) : null}
          <p>
            Since sequence used:{" "}
            {lastServerRequestResolvedEventsResult.sinceSequence === null
              ? "none"
              : String(lastServerRequestResolvedEventsResult.sinceSequence)}
          </p>
          <p>
            Read at:{" "}
            {new Date(lastServerRequestResolvedEventsResult.readAtIso8601).toLocaleTimeString()}
          </p>
          <div className="space-y-2">
            <label
              className="text-xs text-muted-foreground"
              htmlFor="debug-coverage-server-request-resolved-events-thread-filter"
            >
              Thread filter (optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="debug-coverage-server-request-resolved-events-thread-filter"
                data-testid="debug-coverage-server-request-resolved-events-thread-filter"
                type="text"
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                value={threadFilterDraft}
                onChange={(event) => {
                  setThreadFilterDraft(event.target.value);
                }}
                placeholder="thread-123"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="debug-coverage-server-request-resolved-events-thread-filter-clear"
                disabled={threadFilterDraft.length === 0}
                onClick={() => {
                  setThreadFilterDraft("");
                }}
              >
                Clear
              </Button>
            </div>
          </div>
          <p data-testid="debug-coverage-server-request-resolved-events-filter-summary">
            Showing {String(filteredEvents.length)} of{" "}
            {String(lastServerRequestResolvedEventsResult.eventCount)} resolved events
            {normalizedThreadFilter.length > 0 ? ` matching "${threadFilterDraft}"` : ""}.
          </p>
          {filteredEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {lastServerRequestResolvedEventsResult.eventCount === 0
                ? "No server-request resolved events were returned."
                : "No server-request resolved events match the current thread filter."}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredEvents.map((event) => (
                <div
                  key={event.sequence}
                  className="rounded border border-border/60 bg-background/50 p-2 space-y-1"
                  data-testid={`debug-coverage-server-request-resolved-event-${String(event.sequence)}`}
                >
                  <p>
                    requestId={String(event.requestId)} • threadId={event.threadId}
                  </p>
                  <p className="text-muted-foreground">
                    Received: {new Date(event.receivedAtMilliseconds).toLocaleTimeString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

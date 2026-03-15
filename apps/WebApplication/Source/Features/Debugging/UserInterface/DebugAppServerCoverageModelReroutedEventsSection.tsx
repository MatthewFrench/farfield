import { useState } from "react";
import { Button } from "@/Components/UserInterface/Button";
import { type DebugAppServerCoverageModelReroutedEventsResult } from "../DomainModel/DebugAppServerCoverageContracts";

export interface DebugAppServerCoverageModelReroutedEventsSectionProps {
  isRunningCoverageAction: boolean;
  lastModelReroutedEventsResult: DebugAppServerCoverageModelReroutedEventsResult | null;
  onReadModelReroutedEvents: (sinceSequence?: number | null) => void;
}

/**
 * Owns model-reroute notification diagnostics.
 * Operators use this to verify model routing changes and reasons emitted by app-server.
 */
export function DebugAppServerCoverageModelReroutedEventsSection({
  isRunningCoverageAction,
  lastModelReroutedEventsResult,
  onReadModelReroutedEvents,
}: DebugAppServerCoverageModelReroutedEventsSectionProps): React.JSX.Element {
  const [sinceSequenceDraft, setSinceSequenceDraft] = useState("");
  const [threadFilterDraft, setThreadFilterDraft] = useState("");
  const normalizedThreadFilter = threadFilterDraft.trim().toLowerCase();

  const runModelReroutedEventsRead = (): void => {
    const normalizedSinceSequence = sinceSequenceDraft.trim();
    if (normalizedSinceSequence.length === 0) {
      onReadModelReroutedEvents(null);
      return;
    }

    const parsedSinceSequence = Number(normalizedSinceSequence);
    if (!Number.isInteger(parsedSinceSequence) || parsedSinceSequence < 0) {
      return;
    }

    onReadModelReroutedEvents(parsedSinceSequence);
  };

  const filteredEvents =
    lastModelReroutedEventsResult === null
      ? []
      : lastModelReroutedEventsResult.events.filter((event) =>
          event.threadId.toLowerCase().includes(normalizedThreadFilter),
        );

  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Model Rerouted Events
        </h4>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="debug-coverage-model-rerouted-events-read-next-cursor"
            disabled={isRunningCoverageAction || lastModelReroutedEventsResult === null}
            onClick={() => {
              if (lastModelReroutedEventsResult === null) {
                return;
              }
              onReadModelReroutedEvents(lastModelReroutedEventsResult.nextSequence);
            }}
          >
            Read From Next Cursor
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="debug-coverage-model-rerouted-events-read"
            disabled={isRunningCoverageAction}
            onClick={runModelReroutedEventsRead}
          >
            Read Model Reroutes
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <label
          className="text-xs text-muted-foreground"
          htmlFor="debug-coverage-model-rerouted-events-since-sequence"
        >
          Since sequence (optional)
        </label>
        <input
          id="debug-coverage-model-rerouted-events-since-sequence"
          data-testid="debug-coverage-model-rerouted-events-since-sequence"
          type="text"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
          value={sinceSequenceDraft}
          onChange={(event) => {
            setSinceSequenceDraft(event.target.value);
          }}
          placeholder="0"
        />
      </div>
      {lastModelReroutedEventsResult === null ? (
        <p className="text-xs text-muted-foreground">No model-rerouted diagnostics captured.</p>
      ) : (
        <div
          className="rounded border border-border/70 p-2 text-xs space-y-2"
          data-testid="debug-coverage-model-rerouted-events-result"
        >
          <p>Model reroutes returned: {lastModelReroutedEventsResult.eventCount}</p>
          <p>
            Cursor: next={String(lastModelReroutedEventsResult.nextSequence)} • firstAvailable=
            {String(lastModelReroutedEventsResult.firstAvailableSequence)} • resetRequired=
            {lastModelReroutedEventsResult.resetRequired ? "true" : "false"}
          </p>
          {lastModelReroutedEventsResult.resetRequired ? (
            <div className="rounded border border-amber-400/60 bg-amber-50/40 p-2 text-xs space-y-2">
              <p>Cursor indicates a dropped range. Read without since-sequence to resync.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="debug-coverage-model-rerouted-events-read-reset"
                disabled={isRunningCoverageAction}
                onClick={() => {
                  onReadModelReroutedEvents(null);
                }}
              >
                Read Without Cursor
              </Button>
            </div>
          ) : null}
          <p>
            Since sequence used:{" "}
            {lastModelReroutedEventsResult.sinceSequence === null
              ? "none"
              : String(lastModelReroutedEventsResult.sinceSequence)}
          </p>
          <p>
            Read at: {new Date(lastModelReroutedEventsResult.readAtIso8601).toLocaleTimeString()}
          </p>
          <div className="space-y-2">
            <label
              className="text-xs text-muted-foreground"
              htmlFor="debug-coverage-model-rerouted-events-thread-filter"
            >
              Thread filter (optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="debug-coverage-model-rerouted-events-thread-filter"
                data-testid="debug-coverage-model-rerouted-events-thread-filter"
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
                data-testid="debug-coverage-model-rerouted-events-thread-filter-clear"
                disabled={threadFilterDraft.length === 0}
                onClick={() => {
                  setThreadFilterDraft("");
                }}
              >
                Clear
              </Button>
            </div>
          </div>
          <p data-testid="debug-coverage-model-rerouted-events-filter-summary">
            Showing {String(filteredEvents.length)} of{" "}
            {String(lastModelReroutedEventsResult.eventCount)} model reroute events
            {normalizedThreadFilter.length > 0 ? ` matching "${threadFilterDraft}"` : ""}.
          </p>
          {filteredEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {lastModelReroutedEventsResult.eventCount === 0
                ? "No model-rerouted events were returned."
                : "No model-rerouted events match the current thread filter."}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredEvents.map((event) => (
                <div
                  key={event.sequence}
                  className="rounded border border-border/60 bg-background/50 p-2 space-y-1"
                  data-testid={`debug-coverage-model-rerouted-event-${String(event.sequence)}`}
                >
                  <p>
                    threadId={event.threadId} • turnId={event.turnId}
                  </p>
                  <p className="text-muted-foreground">
                    {event.fromModel} {"->"} {event.toModel} ({event.reason})
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

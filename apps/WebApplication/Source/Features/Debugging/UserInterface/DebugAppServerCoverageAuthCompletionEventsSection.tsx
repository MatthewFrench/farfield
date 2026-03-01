import { useState } from "react";
import { Button } from "@/Components/UserInterface/Button";
import { type DebugAppServerCoverageAuthCompletionEventsResult } from "../DomainModel/DebugAppServerCoverageContracts";

export interface DebugAppServerCoverageAuthCompletionEventsSectionProps {
  isRunningCoverageAction: boolean;
  lastAuthCompletionEventsResult: DebugAppServerCoverageAuthCompletionEventsResult | null;
  onReadAuthCompletionEvents: (sinceSequence?: number | null) => void;
}

/**
 * Owns auth-completion notification diagnostics for OAuth and login workflows.
 * This keeps completion visibility explicit without requiring operators to manually filter raw notifications.
 */
export function DebugAppServerCoverageAuthCompletionEventsSection({
  isRunningCoverageAction,
  lastAuthCompletionEventsResult,
  onReadAuthCompletionEvents,
}: DebugAppServerCoverageAuthCompletionEventsSectionProps): React.JSX.Element {
  const [sinceSequenceDraft, setSinceSequenceDraft] = useState("");
  const [methodFilterDraft, setMethodFilterDraft] = useState("");
  const normalizedMethodFilter = methodFilterDraft.trim().toLowerCase();

  const runAuthCompletionEventsRead = (): void => {
    const normalizedSinceSequence = sinceSequenceDraft.trim();
    if (normalizedSinceSequence.length === 0) {
      onReadAuthCompletionEvents(null);
      return;
    }

    const parsedSinceSequence = Number(normalizedSinceSequence);
    if (!Number.isInteger(parsedSinceSequence) || parsedSinceSequence < 0) {
      return;
    }

    onReadAuthCompletionEvents(parsedSinceSequence);
  };

  const filteredEvents =
    lastAuthCompletionEventsResult === null
      ? []
      : lastAuthCompletionEventsResult.events.filter((event) =>
          event.method.toLowerCase().includes(normalizedMethodFilter),
        );

  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Auth Completion Events
        </h4>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="debug-coverage-auth-completion-events-read-next-cursor"
            disabled={isRunningCoverageAction || lastAuthCompletionEventsResult === null}
            onClick={() => {
              if (lastAuthCompletionEventsResult === null) {
                return;
              }
              onReadAuthCompletionEvents(lastAuthCompletionEventsResult.nextSequence);
            }}
          >
            Read From Next Cursor
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="debug-coverage-auth-completion-events-read"
            disabled={isRunningCoverageAction}
            onClick={runAuthCompletionEventsRead}
          >
            Read Auth Completions
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <label
          className="text-xs text-muted-foreground"
          htmlFor="debug-coverage-auth-completion-events-since-sequence"
        >
          Since sequence (optional)
        </label>
        <input
          id="debug-coverage-auth-completion-events-since-sequence"
          data-testid="debug-coverage-auth-completion-events-since-sequence"
          type="text"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
          value={sinceSequenceDraft}
          onChange={(event) => {
            setSinceSequenceDraft(event.target.value);
          }}
          placeholder="0"
        />
      </div>
      {lastAuthCompletionEventsResult === null ? (
        <p className="text-xs text-muted-foreground">No auth-completion diagnostics captured.</p>
      ) : (
        <div
          className="rounded border border-border/70 p-2 text-xs space-y-2"
          data-testid="debug-coverage-auth-completion-events-result"
        >
          <p>Completion events returned: {lastAuthCompletionEventsResult.eventCount}</p>
          <p>
            Cursor: next={String(lastAuthCompletionEventsResult.nextSequence)} • firstAvailable=
            {String(lastAuthCompletionEventsResult.firstAvailableSequence)} • resetRequired=
            {lastAuthCompletionEventsResult.resetRequired ? "true" : "false"}
          </p>
          {lastAuthCompletionEventsResult.resetRequired ? (
            <div className="rounded border border-amber-400/60 bg-amber-50/40 p-2 text-xs space-y-2">
              <p>Cursor indicates a dropped range. Read without a since-sequence to resync.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="debug-coverage-auth-completion-events-read-reset"
                disabled={isRunningCoverageAction}
                onClick={() => {
                  onReadAuthCompletionEvents(null);
                }}
              >
                Read Without Cursor
              </Button>
            </div>
          ) : null}
          <p>
            Since sequence used:{" "}
            {lastAuthCompletionEventsResult.sinceSequence === null
              ? "none"
              : String(lastAuthCompletionEventsResult.sinceSequence)}
          </p>
          <p>
            Read at: {new Date(lastAuthCompletionEventsResult.readAtIso8601).toLocaleTimeString()}
          </p>
          <div className="space-y-2">
            <label
              className="text-xs text-muted-foreground"
              htmlFor="debug-coverage-auth-completion-events-method-filter"
            >
              Method filter (optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="debug-coverage-auth-completion-events-method-filter"
                data-testid="debug-coverage-auth-completion-events-method-filter"
                type="text"
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                value={methodFilterDraft}
                onChange={(event) => {
                  setMethodFilterDraft(event.target.value);
                }}
                placeholder="mcpServer/oauthLogin/completed"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="debug-coverage-auth-completion-events-method-filter-clear"
                disabled={methodFilterDraft.length === 0}
                onClick={() => {
                  setMethodFilterDraft("");
                }}
              >
                Clear
              </Button>
            </div>
          </div>
          {lastAuthCompletionEventsResult.methodCounts.length === 0 ? (
            <p className="text-xs text-muted-foreground">Method counts: none captured.</p>
          ) : (
            <div className="space-y-1">
              <p>Method counts:</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-testid="debug-coverage-auth-completion-events-method-count-all"
                  disabled={methodFilterDraft.length === 0}
                  onClick={() => {
                    setMethodFilterDraft("");
                  }}
                >
                  All
                </Button>
                {lastAuthCompletionEventsResult.methodCounts.map((methodCount) => (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    key={methodCount.method}
                    data-testid={`debug-coverage-auth-completion-events-method-count-${methodCount.method.replaceAll("/", "-")}`}
                    disabled={isRunningCoverageAction}
                    onClick={() => {
                      setMethodFilterDraft(methodCount.method);
                    }}
                  >
                    {methodCount.method} ({String(methodCount.count)})
                  </Button>
                ))}
              </div>
            </div>
          )}
          <p data-testid="debug-coverage-auth-completion-events-filter-summary">
            Showing {String(filteredEvents.length)} of{" "}
            {String(lastAuthCompletionEventsResult.eventCount)} completion events
            {normalizedMethodFilter.length > 0 ? ` matching "${methodFilterDraft}"` : ""}.
          </p>
          {filteredEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {lastAuthCompletionEventsResult.eventCount === 0
                ? "No auth-completion events were returned."
                : "No auth-completion events match the current method filter."}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredEvents.map((event) => (
                <div
                  key={`${event.method}-${String(event.sequence)}`}
                  className="rounded border border-border/60 bg-background/50 p-2 space-y-1"
                  data-testid={`debug-coverage-auth-completion-event-${String(event.sequence)}`}
                >
                  <p>
                    {event.method} • seq {String(event.sequence)}
                  </p>
                  <p className="text-muted-foreground">
                    Status: {event.status} • Subject: {event.subject}
                  </p>
                  {event.errorMessage === null ? null : (
                    <p className="text-red-300">{event.errorMessage}</p>
                  )}
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

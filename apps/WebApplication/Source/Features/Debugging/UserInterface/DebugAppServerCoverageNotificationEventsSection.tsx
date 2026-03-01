import { useState } from "react";
import { Button } from "@/Components/UserInterface/Button";
import { type DebugAppServerCoverageNotificationEventsResult } from "../DomainModel/DebugAppServerCoverageContracts";

export interface DebugAppServerCoverageNotificationEventsSectionProps {
  isRunningCoverageAction: boolean;
  lastNotificationEventsResult: DebugAppServerCoverageNotificationEventsResult | null;
  onReadNotificationEvents: (sinceSequence?: number | null) => void;
}

const NOTIFICATION_METHOD_FILTER_PRESETS = ["turn/", "thread/", "item/", "account/"] as const;

/**
 * Owns app-server notification-event diagnostics controls for coverage verification.
 * Operators use this to inspect raw transport notifications and cursor behavior.
 */
export function DebugAppServerCoverageNotificationEventsSection({
  isRunningCoverageAction,
  lastNotificationEventsResult,
  onReadNotificationEvents,
}: DebugAppServerCoverageNotificationEventsSectionProps): React.JSX.Element {
  const [sinceSequenceDraft, setSinceSequenceDraft] = useState("");
  const [methodFilterDraft, setMethodFilterDraft] = useState("");
  const [copyStatusMessage, setCopyStatusMessage] = useState<string | null>(null);
  const normalizedMethodFilter = methodFilterDraft.trim().toLowerCase();

  const runNotificationEventsRead = (): void => {
    const normalizedSinceSequence = sinceSequenceDraft.trim();
    if (normalizedSinceSequence.length === 0) {
      onReadNotificationEvents(null);
      return;
    }

    const parsedSinceSequence = Number(normalizedSinceSequence);
    if (!Number.isInteger(parsedSinceSequence) || parsedSinceSequence < 0) {
      return;
    }

    onReadNotificationEvents(parsedSinceSequence);
  };

  const filteredEvents =
    lastNotificationEventsResult === null
      ? []
      : lastNotificationEventsResult.events.filter((event) =>
          event.method.toLowerCase().includes(normalizedMethodFilter),
        );

  const copyFilteredEventsAsJson = async (): Promise<void> => {
    if (lastNotificationEventsResult === null) {
      return;
    }

    const clipboard = navigator.clipboard;
    if (!clipboard || typeof clipboard.writeText !== "function") {
      setCopyStatusMessage("Clipboard write is unavailable in this environment.");
      return;
    }

    const payload = {
      sinceSequence: lastNotificationEventsResult.sinceSequence,
      nextSequence: lastNotificationEventsResult.nextSequence,
      firstAvailableSequence: lastNotificationEventsResult.firstAvailableSequence,
      resetRequired: lastNotificationEventsResult.resetRequired,
      methodFilter: normalizedMethodFilter.length === 0 ? null : methodFilterDraft,
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
          Notification Events
        </h4>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="debug-coverage-notification-events-read-next-cursor"
            disabled={isRunningCoverageAction || lastNotificationEventsResult === null}
            onClick={() => {
              if (lastNotificationEventsResult === null) {
                return;
              }
              onReadNotificationEvents(lastNotificationEventsResult.nextSequence);
            }}
          >
            Read From Next Cursor
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="debug-coverage-notification-events-read"
            disabled={isRunningCoverageAction}
            onClick={runNotificationEventsRead}
          >
            Read Notification Events
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <label
          className="text-xs text-muted-foreground"
          htmlFor="debug-coverage-notification-events-since-sequence"
        >
          Since sequence (optional)
        </label>
        <input
          id="debug-coverage-notification-events-since-sequence"
          data-testid="debug-coverage-notification-events-since-sequence"
          type="text"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
          value={sinceSequenceDraft}
          onChange={(event) => {
            setSinceSequenceDraft(event.target.value);
          }}
          placeholder="0"
        />
      </div>
      {lastNotificationEventsResult === null ? (
        <p className="text-xs text-muted-foreground">No notification-event diagnostics captured.</p>
      ) : (
        <div
          className="rounded border border-border/70 p-2 text-xs space-y-2"
          data-testid="debug-coverage-notification-events-result"
        >
          <p>Events returned: {lastNotificationEventsResult.eventCount}</p>
          <p>
            Cursor: next={String(lastNotificationEventsResult.nextSequence)} • firstAvailable=
            {String(lastNotificationEventsResult.firstAvailableSequence)} • resetRequired=
            {lastNotificationEventsResult.resetRequired ? "true" : "false"}
          </p>
          {lastNotificationEventsResult.resetRequired ? (
            <div
              className="rounded border border-amber-400/60 bg-amber-50/40 p-2 text-xs space-y-2"
              data-testid="debug-coverage-notification-events-reset-required"
            >
              <p>
                Returned cursor indicates a dropped range. Read without a since-sequence cursor to
                resynchronize.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="debug-coverage-notification-events-read-reset"
                disabled={isRunningCoverageAction}
                onClick={() => {
                  onReadNotificationEvents(null);
                }}
              >
                Read Without Cursor
              </Button>
            </div>
          ) : null}
          <p>
            Since sequence used:{" "}
            {lastNotificationEventsResult.sinceSequence === null
              ? "none"
              : String(lastNotificationEventsResult.sinceSequence)}
          </p>
          <p>
            Read at: {new Date(lastNotificationEventsResult.readAtIso8601).toLocaleTimeString()}
          </p>
          <div className="space-y-2">
            <label
              className="text-xs text-muted-foreground"
              htmlFor="debug-coverage-notification-events-method-filter"
            >
              Method filter (optional)
            </label>
            <div className="flex flex-wrap gap-2">
              {NOTIFICATION_METHOD_FILTER_PRESETS.map((methodPrefix) => (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  key={methodPrefix}
                  data-testid={`debug-coverage-notification-events-method-preset-${methodPrefix.replace("/", "-")}`}
                  disabled={isRunningCoverageAction}
                  onClick={() => {
                    setMethodFilterDraft(methodPrefix);
                  }}
                >
                  {methodPrefix}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                id="debug-coverage-notification-events-method-filter"
                data-testid="debug-coverage-notification-events-method-filter"
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
                data-testid="debug-coverage-notification-events-method-filter-clear"
                disabled={methodFilterDraft.length === 0}
                onClick={() => {
                  setMethodFilterDraft("");
                }}
              >
                Clear
              </Button>
            </div>
          </div>
          {lastNotificationEventsResult.methodCounts.length === 0 ? (
            <p className="text-xs text-muted-foreground">Method counts: none captured.</p>
          ) : (
            <div className="space-y-1">
              <p>Method counts:</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-testid="debug-coverage-notification-events-method-count-all"
                  disabled={methodFilterDraft.length === 0}
                  onClick={() => {
                    setMethodFilterDraft("");
                  }}
                >
                  All
                </Button>
                {lastNotificationEventsResult.methodCounts.map((methodCount) => (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    key={methodCount.method}
                    data-testid={`debug-coverage-notification-events-method-count-${methodCount.method}`}
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
            <p data-testid="debug-coverage-notification-events-filter-summary">
              Filtered events: {String(filteredEvents.length)} of{" "}
              {String(lastNotificationEventsResult.events.length)}
            </p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="debug-coverage-notification-events-copy-filtered-json"
            onClick={() => {
              void copyFilteredEventsAsJson();
            }}
          >
            Copy Filtered JSON
          </Button>
          {copyStatusMessage === null ? null : (
            <p
              className="text-xs text-muted-foreground"
              data-testid="debug-coverage-notification-events-copy-status"
            >
              {copyStatusMessage}
            </p>
          )}
          {filteredEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {lastNotificationEventsResult.events.length === 0 ||
              normalizedMethodFilter.length === 0
                ? "No notification events in the returned batch."
                : "No events match the current method filter."}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredEvents.map((event, eventIndex) => (
                <div
                  key={`${event.method}-${String(event.sequence)}-${String(eventIndex)}`}
                  data-testid={`debug-coverage-notification-events-event-${String(eventIndex)}`}
                  className="rounded border border-border/60 p-2 space-y-1"
                >
                  <p>
                    {event.method} • sequence={String(event.sequence)}
                  </p>
                  <p>receivedAtMilliseconds={String(event.receivedAtMilliseconds)}</p>
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

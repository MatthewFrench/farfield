import { useState } from "react";
import { Button } from "@/Components/UserInterface/Button";
import { type DebugAppServerCoverageFuzzySessionNotificationsResult } from "../DomainModel/DebugAppServerCoverageContracts";

export interface DebugAppServerCoverageFuzzySessionNotificationsSectionProps {
  isRunningCoverageAction: boolean;
  lastFuzzySessionNotificationsResult: DebugAppServerCoverageFuzzySessionNotificationsResult | null;
  onReadFuzzySessionNotifications: (sinceSequence?: number | null) => void;
}

/**
 * Owns fuzzy-session lifecycle notification diagnostics.
 * Operators use this to verify asynchronous session update/completion behavior beyond mutation responses.
 */
export function DebugAppServerCoverageFuzzySessionNotificationsSection({
  isRunningCoverageAction,
  lastFuzzySessionNotificationsResult,
  onReadFuzzySessionNotifications,
}: DebugAppServerCoverageFuzzySessionNotificationsSectionProps): React.JSX.Element {
  const [sinceSequenceDraft, setSinceSequenceDraft] = useState("");
  const [methodFilterDraft, setMethodFilterDraft] = useState("");
  const normalizedMethodFilter = methodFilterDraft.trim().toLowerCase();

  const runFuzzySessionNotificationsRead = (): void => {
    const normalizedSinceSequence = sinceSequenceDraft.trim();
    if (normalizedSinceSequence.length === 0) {
      onReadFuzzySessionNotifications(null);
      return;
    }

    const parsedSinceSequence = Number(normalizedSinceSequence);
    if (!Number.isInteger(parsedSinceSequence) || parsedSinceSequence < 0) {
      return;
    }

    onReadFuzzySessionNotifications(parsedSinceSequence);
  };

  const filteredEvents =
    lastFuzzySessionNotificationsResult === null
      ? []
      : lastFuzzySessionNotificationsResult.events.filter((event) =>
          event.method.toLowerCase().includes(normalizedMethodFilter),
        );

  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Fuzzy Session Notifications
        </h4>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="debug-coverage-fuzzy-session-notifications-read-next-cursor"
            disabled={isRunningCoverageAction || lastFuzzySessionNotificationsResult === null}
            onClick={() => {
              if (lastFuzzySessionNotificationsResult === null) {
                return;
              }
              onReadFuzzySessionNotifications(lastFuzzySessionNotificationsResult.nextSequence);
            }}
          >
            Read From Next Cursor
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="debug-coverage-fuzzy-session-notifications-read"
            disabled={isRunningCoverageAction}
            onClick={runFuzzySessionNotificationsRead}
          >
            Read Session Notifications
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <label
          className="text-xs text-muted-foreground"
          htmlFor="debug-coverage-fuzzy-session-notifications-since-sequence"
        >
          Since sequence (optional)
        </label>
        <input
          id="debug-coverage-fuzzy-session-notifications-since-sequence"
          data-testid="debug-coverage-fuzzy-session-notifications-since-sequence"
          type="text"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
          value={sinceSequenceDraft}
          onChange={(event) => {
            setSinceSequenceDraft(event.target.value);
          }}
          placeholder="0"
        />
      </div>
      {lastFuzzySessionNotificationsResult === null ? (
        <p className="text-xs text-muted-foreground">No fuzzy-session notifications captured.</p>
      ) : (
        <div
          className="rounded border border-border/70 p-2 text-xs space-y-2"
          data-testid="debug-coverage-fuzzy-session-notifications-result"
        >
          <p>Session notifications returned: {lastFuzzySessionNotificationsResult.eventCount}</p>
          <p>
            Cursor: next={String(lastFuzzySessionNotificationsResult.nextSequence)} •
            firstAvailable={String(lastFuzzySessionNotificationsResult.firstAvailableSequence)} •
            resetRequired={lastFuzzySessionNotificationsResult.resetRequired ? "true" : "false"}
          </p>
          {lastFuzzySessionNotificationsResult.resetRequired ? (
            <div className="rounded border border-amber-400/60 bg-amber-50/40 p-2 text-xs space-y-2">
              <p>Cursor indicates a dropped range. Read without since-sequence to resync.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="debug-coverage-fuzzy-session-notifications-read-reset"
                disabled={isRunningCoverageAction}
                onClick={() => {
                  onReadFuzzySessionNotifications(null);
                }}
              >
                Read Without Cursor
              </Button>
            </div>
          ) : null}
          <p>
            Since sequence used:{" "}
            {lastFuzzySessionNotificationsResult.sinceSequence === null
              ? "none"
              : String(lastFuzzySessionNotificationsResult.sinceSequence)}
          </p>
          <p>
            Read at:{" "}
            {new Date(lastFuzzySessionNotificationsResult.readAtIso8601).toLocaleTimeString()}
          </p>
          <div className="space-y-2">
            <label
              className="text-xs text-muted-foreground"
              htmlFor="debug-coverage-fuzzy-session-notifications-method-filter"
            >
              Method filter (optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="debug-coverage-fuzzy-session-notifications-method-filter"
                data-testid="debug-coverage-fuzzy-session-notifications-method-filter"
                type="text"
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                value={methodFilterDraft}
                onChange={(event) => {
                  setMethodFilterDraft(event.target.value);
                }}
                placeholder="fuzzyFileSearch/sessionCompleted"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="debug-coverage-fuzzy-session-notifications-method-filter-clear"
                disabled={methodFilterDraft.length === 0}
                onClick={() => {
                  setMethodFilterDraft("");
                }}
              >
                Clear
              </Button>
            </div>
          </div>
          {lastFuzzySessionNotificationsResult.methodCounts.length === 0 ? (
            <p className="text-xs text-muted-foreground">Method counts: none captured.</p>
          ) : (
            <div className="space-y-1">
              <p>Method counts:</p>
              <div className="flex flex-wrap gap-2">
                {lastFuzzySessionNotificationsResult.methodCounts.map((methodCount) => (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    key={methodCount.method}
                    data-testid={`debug-coverage-fuzzy-session-notifications-method-count-${methodCount.method.replaceAll("/", "-")}`}
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
          <p data-testid="debug-coverage-fuzzy-session-notifications-filter-summary">
            Showing {String(filteredEvents.length)} of{" "}
            {String(lastFuzzySessionNotificationsResult.eventCount)} session notifications
            {normalizedMethodFilter.length > 0 ? ` matching "${methodFilterDraft}"` : ""}.
          </p>
          {filteredEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {lastFuzzySessionNotificationsResult.eventCount === 0
                ? "No fuzzy-session notifications were returned."
                : "No fuzzy-session notifications match the current method filter."}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredEvents.map((event) => (
                <div
                  key={`${event.method}-${String(event.sequence)}`}
                  className="rounded border border-border/60 bg-background/50 p-2 space-y-1"
                  data-testid={`debug-coverage-fuzzy-session-notification-${String(event.sequence)}`}
                >
                  <p>
                    {event.method} • sessionId={event.sessionId}
                  </p>
                  <p className="text-muted-foreground">
                    Query: {event.query ?? "(none)"} • Files:{" "}
                    {event.fileCount === null ? "(none)" : String(event.fileCount)}
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

import { useState } from "react";
import { Button } from "@/Components/UserInterface/Button";
import { type DebugAppServerCoverageErrorNotificationsResult } from "../DomainModel/DebugAppServerCoverageContracts";

export interface DebugAppServerCoverageErrorNotificationsSectionProps {
  isRunningCoverageAction: boolean;
  lastErrorNotificationsResult: DebugAppServerCoverageErrorNotificationsResult | null;
  onReadErrorNotifications: (sinceSequence?: number | null) => void;
}

/**
 * Owns error notification diagnostics from app-server turns.
 * Operators use this to inspect retry signals and codex error classification details.
 */
export function DebugAppServerCoverageErrorNotificationsSection({
  isRunningCoverageAction,
  lastErrorNotificationsResult,
  onReadErrorNotifications,
}: DebugAppServerCoverageErrorNotificationsSectionProps): React.JSX.Element {
  const [sinceSequenceDraft, setSinceSequenceDraft] = useState("");
  const [threadFilterDraft, setThreadFilterDraft] = useState("");
  const normalizedThreadFilter = threadFilterDraft.trim().toLowerCase();

  const runErrorNotificationsRead = (): void => {
    const normalizedSinceSequence = sinceSequenceDraft.trim();
    if (normalizedSinceSequence.length === 0) {
      onReadErrorNotifications(null);
      return;
    }

    const parsedSinceSequence = Number(normalizedSinceSequence);
    if (!Number.isInteger(parsedSinceSequence) || parsedSinceSequence < 0) {
      return;
    }

    onReadErrorNotifications(parsedSinceSequence);
  };

  const filteredEvents =
    lastErrorNotificationsResult === null
      ? []
      : lastErrorNotificationsResult.events.filter((event) =>
          event.threadId.toLowerCase().includes(normalizedThreadFilter),
        );

  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Error Notifications
        </h4>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="debug-coverage-error-notifications-read-next-cursor"
            disabled={isRunningCoverageAction || lastErrorNotificationsResult === null}
            onClick={() => {
              if (lastErrorNotificationsResult === null) {
                return;
              }
              onReadErrorNotifications(lastErrorNotificationsResult.nextSequence);
            }}
          >
            Read From Next Cursor
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="debug-coverage-error-notifications-read"
            disabled={isRunningCoverageAction}
            onClick={runErrorNotificationsRead}
          >
            Read Errors
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <label
          className="text-xs text-muted-foreground"
          htmlFor="debug-coverage-error-notifications-since-sequence"
        >
          Since sequence (optional)
        </label>
        <input
          id="debug-coverage-error-notifications-since-sequence"
          data-testid="debug-coverage-error-notifications-since-sequence"
          type="text"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
          value={sinceSequenceDraft}
          onChange={(event) => {
            setSinceSequenceDraft(event.target.value);
          }}
          placeholder="0"
        />
      </div>
      {lastErrorNotificationsResult === null ? (
        <p className="text-xs text-muted-foreground">No error notifications captured.</p>
      ) : (
        <div
          className="rounded border border-border/70 p-2 text-xs space-y-2"
          data-testid="debug-coverage-error-notifications-result"
        >
          <p>Error notifications returned: {lastErrorNotificationsResult.eventCount}</p>
          <p>Retry count: {String(lastErrorNotificationsResult.retryCount)}</p>
          <p>
            Cursor: next={String(lastErrorNotificationsResult.nextSequence)} • firstAvailable=
            {String(lastErrorNotificationsResult.firstAvailableSequence)} • resetRequired=
            {lastErrorNotificationsResult.resetRequired ? "true" : "false"}
          </p>
          {lastErrorNotificationsResult.resetRequired ? (
            <div className="rounded border border-amber-400/60 bg-amber-50/40 p-2 text-xs space-y-2">
              <p>Cursor indicates a dropped range. Read without since-sequence to resync.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="debug-coverage-error-notifications-read-reset"
                disabled={isRunningCoverageAction}
                onClick={() => {
                  onReadErrorNotifications(null);
                }}
              >
                Read Without Cursor
              </Button>
            </div>
          ) : null}
          <p>
            Since sequence used:{" "}
            {lastErrorNotificationsResult.sinceSequence === null
              ? "none"
              : String(lastErrorNotificationsResult.sinceSequence)}
          </p>
          <p>
            Read at: {new Date(lastErrorNotificationsResult.readAtIso8601).toLocaleTimeString()}
          </p>
          <div className="space-y-2">
            <label
              className="text-xs text-muted-foreground"
              htmlFor="debug-coverage-error-notifications-thread-filter"
            >
              Thread filter (optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="debug-coverage-error-notifications-thread-filter"
                data-testid="debug-coverage-error-notifications-thread-filter"
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
                data-testid="debug-coverage-error-notifications-thread-filter-clear"
                disabled={threadFilterDraft.length === 0}
                onClick={() => {
                  setThreadFilterDraft("");
                }}
              >
                Clear
              </Button>
            </div>
          </div>
          <p data-testid="debug-coverage-error-notifications-filter-summary">
            Showing {String(filteredEvents.length)} of{" "}
            {String(lastErrorNotificationsResult.eventCount)} error notifications
            {normalizedThreadFilter.length > 0 ? ` for thread "${threadFilterDraft}"` : ""}.
          </p>
          {filteredEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {lastErrorNotificationsResult.eventCount === 0
                ? "No error notifications were returned."
                : "No error notifications match the current thread filter."}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredEvents.map((event) => (
                <div
                  key={event.sequence}
                  className="rounded border border-border/60 bg-background/50 p-2 space-y-1"
                  data-testid={`debug-coverage-error-notification-${String(event.sequence)}`}
                >
                  <p>
                    threadId={event.threadId} • turnId={event.turnId}
                  </p>
                  <p className="text-muted-foreground">{event.message}</p>
                  <p className="text-muted-foreground">
                    codexErrorInfo={event.codexErrorInfoSummary ?? "(none)"} • willRetry=
                    {event.willRetry ? "true" : "false"}
                  </p>
                  {event.additionalDetails === null ? null : (
                    <p className="text-muted-foreground">Details: {event.additionalDetails}</p>
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

import { useState } from "react";
import { Button } from "@/Components/UserInterface/Button";
import { type DebugAppServerCoverageTurnLifecycleNotificationsResult } from "../DomainModel/DebugAppServerCoverageContracts";

export interface DebugAppServerCoverageTurnLifecycleNotificationsSectionProps {
  isRunningCoverageAction: boolean;
  lastTurnLifecycleNotificationsResult: DebugAppServerCoverageTurnLifecycleNotificationsResult | null;
  onReadTurnLifecycleNotifications: (sinceSequence?: number | null) => void;
}

/**
 * Owns turn-lifecycle notification diagnostics.
 * Operators use this to verify turn-start, completion, plan updates, and diff updates.
 */
export function DebugAppServerCoverageTurnLifecycleNotificationsSection({
  isRunningCoverageAction,
  lastTurnLifecycleNotificationsResult,
  onReadTurnLifecycleNotifications,
}: DebugAppServerCoverageTurnLifecycleNotificationsSectionProps): React.JSX.Element {
  const [sinceSequenceDraft, setSinceSequenceDraft] = useState("");
  const [threadFilterDraft, setThreadFilterDraft] = useState("");
  const [methodFilterDraft, setMethodFilterDraft] = useState("");
  const normalizedThreadFilter = threadFilterDraft.trim().toLowerCase();
  const normalizedMethodFilter = methodFilterDraft.trim().toLowerCase();

  const runTurnLifecycleNotificationsRead = (): void => {
    const normalizedSinceSequence = sinceSequenceDraft.trim();
    if (normalizedSinceSequence.length === 0) {
      onReadTurnLifecycleNotifications(null);
      return;
    }

    const parsedSinceSequence = Number(normalizedSinceSequence);
    if (!Number.isInteger(parsedSinceSequence) || parsedSinceSequence < 0) {
      return;
    }

    onReadTurnLifecycleNotifications(parsedSinceSequence);
  };

  const filteredEvents =
    lastTurnLifecycleNotificationsResult === null
      ? []
      : lastTurnLifecycleNotificationsResult.events.filter((event) => {
          const matchesThread =
            normalizedThreadFilter.length === 0 ||
            event.threadId.toLowerCase().includes(normalizedThreadFilter);
          const matchesMethod =
            normalizedMethodFilter.length === 0 ||
            event.method.toLowerCase().includes(normalizedMethodFilter);
          return matchesThread && matchesMethod;
        });

  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Turn Lifecycle Notifications
        </h4>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="debug-coverage-turn-lifecycle-notifications-read-next-cursor"
            disabled={isRunningCoverageAction || lastTurnLifecycleNotificationsResult === null}
            onClick={() => {
              if (lastTurnLifecycleNotificationsResult === null) {
                return;
              }
              onReadTurnLifecycleNotifications(lastTurnLifecycleNotificationsResult.nextSequence);
            }}
          >
            Read From Next Cursor
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="debug-coverage-turn-lifecycle-notifications-read"
            disabled={isRunningCoverageAction}
            onClick={runTurnLifecycleNotificationsRead}
          >
            Read Turn Lifecycle
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <label
          className="text-xs text-muted-foreground"
          htmlFor="debug-coverage-turn-lifecycle-notifications-since-sequence"
        >
          Since sequence (optional)
        </label>
        <input
          id="debug-coverage-turn-lifecycle-notifications-since-sequence"
          data-testid="debug-coverage-turn-lifecycle-notifications-since-sequence"
          type="text"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
          value={sinceSequenceDraft}
          onChange={(event) => {
            setSinceSequenceDraft(event.target.value);
          }}
          placeholder="0"
        />
      </div>
      {lastTurnLifecycleNotificationsResult === null ? (
        <p className="text-xs text-muted-foreground">No turn-lifecycle notifications captured.</p>
      ) : (
        <div
          className="rounded border border-border/70 p-2 text-xs space-y-2"
          data-testid="debug-coverage-turn-lifecycle-notifications-result"
        >
          <p>
            Turn-lifecycle notifications returned: {lastTurnLifecycleNotificationsResult.eventCount}
          </p>
          <p>
            Cursor: next={String(lastTurnLifecycleNotificationsResult.nextSequence)} •
            firstAvailable={String(lastTurnLifecycleNotificationsResult.firstAvailableSequence)} •
            resetRequired=
            {lastTurnLifecycleNotificationsResult.resetRequired ? "true" : "false"}
          </p>
          {lastTurnLifecycleNotificationsResult.resetRequired ? (
            <div className="rounded border border-amber-400/60 bg-amber-50/40 p-2 text-xs space-y-2">
              <p>Cursor indicates a dropped range. Read without since-sequence to resync.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="debug-coverage-turn-lifecycle-notifications-read-reset"
                disabled={isRunningCoverageAction}
                onClick={() => {
                  onReadTurnLifecycleNotifications(null);
                }}
              >
                Read Without Cursor
              </Button>
            </div>
          ) : null}
          <p>
            Since sequence used:{" "}
            {lastTurnLifecycleNotificationsResult.sinceSequence === null
              ? "none"
              : String(lastTurnLifecycleNotificationsResult.sinceSequence)}
          </p>
          <p>
            Read at:{" "}
            {new Date(lastTurnLifecycleNotificationsResult.readAtIso8601).toLocaleTimeString()}
          </p>
          <div className="space-y-2">
            <label
              className="text-xs text-muted-foreground"
              htmlFor="debug-coverage-turn-lifecycle-notifications-thread-filter"
            >
              Thread filter (optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="debug-coverage-turn-lifecycle-notifications-thread-filter"
                data-testid="debug-coverage-turn-lifecycle-notifications-thread-filter"
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
                data-testid="debug-coverage-turn-lifecycle-notifications-thread-filter-clear"
                disabled={threadFilterDraft.length === 0}
                onClick={() => {
                  setThreadFilterDraft("");
                }}
              >
                Clear
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <label
              className="text-xs text-muted-foreground"
              htmlFor="debug-coverage-turn-lifecycle-notifications-method-filter"
            >
              Method filter (optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="debug-coverage-turn-lifecycle-notifications-method-filter"
                data-testid="debug-coverage-turn-lifecycle-notifications-method-filter"
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
                data-testid="debug-coverage-turn-lifecycle-notifications-method-filter-clear"
                disabled={methodFilterDraft.length === 0}
                onClick={() => {
                  setMethodFilterDraft("");
                }}
              >
                Clear
              </Button>
            </div>
          </div>
          {lastTurnLifecycleNotificationsResult.methodCounts.length === 0 ? (
            <p className="text-xs text-muted-foreground">Method counts: none captured.</p>
          ) : (
            <div className="space-y-1">
              <p>Method counts:</p>
              <div className="flex flex-wrap gap-2">
                {lastTurnLifecycleNotificationsResult.methodCounts.map((methodCount) => (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    key={methodCount.method}
                    data-testid={`debug-coverage-turn-lifecycle-notifications-method-count-${methodCount.method.replaceAll("/", "-")}`}
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
          <p data-testid="debug-coverage-turn-lifecycle-notifications-filter-summary">
            Showing {String(filteredEvents.length)} of{" "}
            {String(lastTurnLifecycleNotificationsResult.eventCount)} turn-lifecycle notifications
            {normalizedThreadFilter.length > 0 ? ` for thread "${threadFilterDraft}"` : ""}
            {normalizedMethodFilter.length > 0 ? ` matching method "${methodFilterDraft}"` : ""}.
          </p>
          {filteredEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {lastTurnLifecycleNotificationsResult.eventCount === 0
                ? "No turn-lifecycle notifications were returned."
                : "No turn-lifecycle notifications match the current filters."}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredEvents.map((event) => (
                <div
                  key={`${event.method}-${String(event.sequence)}`}
                  className="rounded border border-border/60 bg-background/50 p-2 space-y-1"
                  data-testid={`debug-coverage-turn-lifecycle-notification-${String(event.sequence)}`}
                >
                  <p>
                    {event.method} • threadId={event.threadId} • turnId={event.turnId}
                  </p>
                  <p className="text-muted-foreground">
                    Status: {event.turnStatus ?? "(none)"} • Plan steps:{" "}
                    {event.planStepCount === null ? "(none)" : String(event.planStepCount)} • Diff
                    lines: {event.diffLineCount === null ? "(none)" : String(event.diffLineCount)}
                  </p>
                  <p className="text-muted-foreground">
                    Explanation: {event.explanation === null ? "(none)" : event.explanation}
                  </p>
                  {event.errorMessage === null ? null : (
                    <p className="text-muted-foreground">Error: {event.errorMessage}</p>
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

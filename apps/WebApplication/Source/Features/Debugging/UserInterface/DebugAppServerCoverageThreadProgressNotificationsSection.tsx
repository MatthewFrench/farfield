import { useState } from "react";
import { Button } from "@/Components/UserInterface/Button";
import { type DebugAppServerCoverageThreadProgressNotificationsResult } from "../DomainModel/DebugAppServerCoverageThreadProgressContracts";

export interface DebugAppServerCoverageThreadProgressNotificationsSectionProps {
  isRunningCoverageAction: boolean;
  lastThreadProgressNotificationsResult: DebugAppServerCoverageThreadProgressNotificationsResult | null;
  onReadThreadProgressNotifications: (sinceSequence?: number | null) => void;
}

/**
 * Owns thread-progress notification diagnostics.
 * Operators use this to validate thread-start, compaction, and token-usage updates in one timeline.
 */
export function DebugAppServerCoverageThreadProgressNotificationsSection({
  isRunningCoverageAction,
  lastThreadProgressNotificationsResult,
  onReadThreadProgressNotifications,
}: DebugAppServerCoverageThreadProgressNotificationsSectionProps): React.JSX.Element {
  const [sinceSequenceDraft, setSinceSequenceDraft] = useState("");
  const [threadFilterDraft, setThreadFilterDraft] = useState("");
  const [methodFilterDraft, setMethodFilterDraft] = useState("");
  const normalizedThreadFilter = threadFilterDraft.trim().toLowerCase();
  const normalizedMethodFilter = methodFilterDraft.trim().toLowerCase();

  const runThreadProgressNotificationsRead = (): void => {
    const normalizedSinceSequence = sinceSequenceDraft.trim();
    if (normalizedSinceSequence.length === 0) {
      onReadThreadProgressNotifications(null);
      return;
    }

    const parsedSinceSequence = Number(normalizedSinceSequence);
    if (!Number.isInteger(parsedSinceSequence) || parsedSinceSequence < 0) {
      return;
    }

    onReadThreadProgressNotifications(parsedSinceSequence);
  };

  const filteredEvents =
    lastThreadProgressNotificationsResult === null
      ? []
      : lastThreadProgressNotificationsResult.events.filter((event) => {
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
          Thread Progress Notifications
        </h4>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="debug-coverage-thread-progress-notifications-read-next-cursor"
            disabled={isRunningCoverageAction || lastThreadProgressNotificationsResult === null}
            onClick={() => {
              if (lastThreadProgressNotificationsResult === null) {
                return;
              }
              onReadThreadProgressNotifications(lastThreadProgressNotificationsResult.nextSequence);
            }}
          >
            Read From Next Cursor
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="debug-coverage-thread-progress-notifications-read"
            disabled={isRunningCoverageAction}
            onClick={runThreadProgressNotificationsRead}
          >
            Read Thread Progress
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <label
          className="text-xs text-muted-foreground"
          htmlFor="debug-coverage-thread-progress-notifications-since-sequence"
        >
          Since sequence (optional)
        </label>
        <input
          id="debug-coverage-thread-progress-notifications-since-sequence"
          data-testid="debug-coverage-thread-progress-notifications-since-sequence"
          type="text"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
          value={sinceSequenceDraft}
          onChange={(event) => {
            setSinceSequenceDraft(event.target.value);
          }}
          placeholder="0"
        />
      </div>
      {lastThreadProgressNotificationsResult === null ? (
        <p className="text-xs text-muted-foreground">No thread-progress notifications captured.</p>
      ) : (
        <div
          className="rounded border border-border/70 p-2 text-xs space-y-2"
          data-testid="debug-coverage-thread-progress-notifications-result"
        >
          <p>
            Thread-progress notifications returned:{" "}
            {lastThreadProgressNotificationsResult.eventCount}
          </p>
          <p>
            Cursor: next={String(lastThreadProgressNotificationsResult.nextSequence)} •
            firstAvailable={String(lastThreadProgressNotificationsResult.firstAvailableSequence)} •
            resetRequired=
            {lastThreadProgressNotificationsResult.resetRequired ? "true" : "false"}
          </p>
          {lastThreadProgressNotificationsResult.resetRequired ? (
            <div className="rounded border border-amber-400/60 bg-amber-50/40 p-2 text-xs space-y-2">
              <p>Cursor indicates a dropped range. Read without since-sequence to resync.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="debug-coverage-thread-progress-notifications-read-reset"
                disabled={isRunningCoverageAction}
                onClick={() => {
                  onReadThreadProgressNotifications(null);
                }}
              >
                Read Without Cursor
              </Button>
            </div>
          ) : null}
          <p>
            Since sequence used:{" "}
            {lastThreadProgressNotificationsResult.sinceSequence === null
              ? "none"
              : String(lastThreadProgressNotificationsResult.sinceSequence)}
          </p>
          <p>
            Read at:{" "}
            {new Date(lastThreadProgressNotificationsResult.readAtIso8601).toLocaleTimeString()}
          </p>
          <div className="space-y-2">
            <label
              className="text-xs text-muted-foreground"
              htmlFor="debug-coverage-thread-progress-notifications-thread-filter"
            >
              Thread filter (optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="debug-coverage-thread-progress-notifications-thread-filter"
                data-testid="debug-coverage-thread-progress-notifications-thread-filter"
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
                data-testid="debug-coverage-thread-progress-notifications-thread-filter-clear"
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
              htmlFor="debug-coverage-thread-progress-notifications-method-filter"
            >
              Method filter (optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="debug-coverage-thread-progress-notifications-method-filter"
                data-testid="debug-coverage-thread-progress-notifications-method-filter"
                type="text"
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                value={methodFilterDraft}
                onChange={(event) => {
                  setMethodFilterDraft(event.target.value);
                }}
                placeholder="thread/tokenUsage/updated"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="debug-coverage-thread-progress-notifications-method-filter-clear"
                disabled={methodFilterDraft.length === 0}
                onClick={() => {
                  setMethodFilterDraft("");
                }}
              >
                Clear
              </Button>
            </div>
          </div>
          {lastThreadProgressNotificationsResult.methodCounts.length === 0 ? (
            <p className="text-xs text-muted-foreground">Method counts: none captured.</p>
          ) : (
            <div className="space-y-1">
              <p>Method counts:</p>
              <div className="flex flex-wrap gap-2">
                {lastThreadProgressNotificationsResult.methodCounts.map((methodCount) => (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    key={methodCount.method}
                    data-testid={`debug-coverage-thread-progress-notifications-method-count-${methodCount.method.replaceAll("/", "-")}`}
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
          <p data-testid="debug-coverage-thread-progress-notifications-filter-summary">
            Showing {String(filteredEvents.length)} of{" "}
            {String(lastThreadProgressNotificationsResult.eventCount)} thread-progress notifications
            {normalizedThreadFilter.length > 0 ? ` for thread "${threadFilterDraft}"` : ""}
            {normalizedMethodFilter.length > 0 ? ` matching method "${methodFilterDraft}"` : ""}.
          </p>
          {filteredEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {lastThreadProgressNotificationsResult.eventCount === 0
                ? "No thread-progress notifications were returned."
                : "No thread-progress notifications match the current filters."}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredEvents.map((event) => (
                <div
                  key={`${event.method}-${String(event.sequence)}`}
                  className="rounded border border-border/60 bg-background/50 p-2 space-y-1"
                  data-testid={`debug-coverage-thread-progress-notification-${String(event.sequence)}`}
                >
                  <p>
                    {event.method} • threadId={event.threadId} • turnId=
                    {event.turnId ?? "(none)"}
                  </p>
                  <p className="text-muted-foreground">
                    modelProvider={event.modelProvider ?? "(none)"} • totalTokens=
                    {event.totalTokens === null ? "(none)" : String(event.totalTokens)} •
                    lastTotalTokens=
                    {event.lastTotalTokens === null ? "(none)" : String(event.lastTotalTokens)}
                  </p>
                  <p className="text-muted-foreground">
                    modelContextWindow=
                    {event.modelContextWindow === null
                      ? "(none)"
                      : String(event.modelContextWindow)}
                  </p>
                  <p className="text-muted-foreground break-words">
                    Preview: {event.preview === null ? "(none)" : event.preview}
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

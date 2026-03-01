import { useState } from "react";
import { Button } from "@/Components/UserInterface/Button";
import { type DebugAppServerCoverageItemLifecycleNotificationsResult } from "../DomainModel/DebugAppServerCoverageContracts";

export interface DebugAppServerCoverageItemLifecycleNotificationsSectionProps {
  isRunningCoverageAction: boolean;
  lastItemLifecycleNotificationsResult: DebugAppServerCoverageItemLifecycleNotificationsResult | null;
  onReadItemLifecycleNotifications: (sinceSequence?: number | null) => void;
}

/**
 * Owns item-lifecycle notification diagnostics.
 * Operators use this to verify item start/completion plus raw-response item identity mapping.
 */
export function DebugAppServerCoverageItemLifecycleNotificationsSection({
  isRunningCoverageAction,
  lastItemLifecycleNotificationsResult,
  onReadItemLifecycleNotifications,
}: DebugAppServerCoverageItemLifecycleNotificationsSectionProps): React.JSX.Element {
  const [sinceSequenceDraft, setSinceSequenceDraft] = useState("");
  const [threadFilterDraft, setThreadFilterDraft] = useState("");
  const [methodFilterDraft, setMethodFilterDraft] = useState("");
  const normalizedThreadFilter = threadFilterDraft.trim().toLowerCase();
  const normalizedMethodFilter = methodFilterDraft.trim().toLowerCase();

  const runItemLifecycleNotificationsRead = (): void => {
    const normalizedSinceSequence = sinceSequenceDraft.trim();
    if (normalizedSinceSequence.length === 0) {
      onReadItemLifecycleNotifications(null);
      return;
    }

    const parsedSinceSequence = Number(normalizedSinceSequence);
    if (!Number.isInteger(parsedSinceSequence) || parsedSinceSequence < 0) {
      return;
    }

    onReadItemLifecycleNotifications(parsedSinceSequence);
  };

  const filteredEvents =
    lastItemLifecycleNotificationsResult === null
      ? []
      : lastItemLifecycleNotificationsResult.events.filter((event) => {
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
          Item Lifecycle Notifications
        </h4>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="debug-coverage-item-lifecycle-notifications-read-next-cursor"
            disabled={isRunningCoverageAction || lastItemLifecycleNotificationsResult === null}
            onClick={() => {
              if (lastItemLifecycleNotificationsResult === null) {
                return;
              }
              onReadItemLifecycleNotifications(lastItemLifecycleNotificationsResult.nextSequence);
            }}
          >
            Read From Next Cursor
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="debug-coverage-item-lifecycle-notifications-read"
            disabled={isRunningCoverageAction}
            onClick={runItemLifecycleNotificationsRead}
          >
            Read Item Lifecycle
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <label
          className="text-xs text-muted-foreground"
          htmlFor="debug-coverage-item-lifecycle-notifications-since-sequence"
        >
          Since sequence (optional)
        </label>
        <input
          id="debug-coverage-item-lifecycle-notifications-since-sequence"
          data-testid="debug-coverage-item-lifecycle-notifications-since-sequence"
          type="text"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
          value={sinceSequenceDraft}
          onChange={(event) => {
            setSinceSequenceDraft(event.target.value);
          }}
          placeholder="0"
        />
      </div>
      {lastItemLifecycleNotificationsResult === null ? (
        <p className="text-xs text-muted-foreground">No item-lifecycle notifications captured.</p>
      ) : (
        <div
          className="rounded border border-border/70 p-2 text-xs space-y-2"
          data-testid="debug-coverage-item-lifecycle-notifications-result"
        >
          <p>
            Item-lifecycle notifications returned: {lastItemLifecycleNotificationsResult.eventCount}
          </p>
          <p>
            Cursor: next={String(lastItemLifecycleNotificationsResult.nextSequence)} •
            firstAvailable={String(lastItemLifecycleNotificationsResult.firstAvailableSequence)} •
            resetRequired=
            {lastItemLifecycleNotificationsResult.resetRequired ? "true" : "false"}
          </p>
          {lastItemLifecycleNotificationsResult.resetRequired ? (
            <div className="rounded border border-amber-400/60 bg-amber-50/40 p-2 text-xs space-y-2">
              <p>Cursor indicates a dropped range. Read without since-sequence to resync.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="debug-coverage-item-lifecycle-notifications-read-reset"
                disabled={isRunningCoverageAction}
                onClick={() => {
                  onReadItemLifecycleNotifications(null);
                }}
              >
                Read Without Cursor
              </Button>
            </div>
          ) : null}
          <p>
            Since sequence used:{" "}
            {lastItemLifecycleNotificationsResult.sinceSequence === null
              ? "none"
              : String(lastItemLifecycleNotificationsResult.sinceSequence)}
          </p>
          <p>
            Read at:{" "}
            {new Date(lastItemLifecycleNotificationsResult.readAtIso8601).toLocaleTimeString()}
          </p>
          <div className="space-y-2">
            <label
              className="text-xs text-muted-foreground"
              htmlFor="debug-coverage-item-lifecycle-notifications-thread-filter"
            >
              Thread filter (optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="debug-coverage-item-lifecycle-notifications-thread-filter"
                data-testid="debug-coverage-item-lifecycle-notifications-thread-filter"
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
                data-testid="debug-coverage-item-lifecycle-notifications-thread-filter-clear"
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
              htmlFor="debug-coverage-item-lifecycle-notifications-method-filter"
            >
              Method filter (optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="debug-coverage-item-lifecycle-notifications-method-filter"
                data-testid="debug-coverage-item-lifecycle-notifications-method-filter"
                type="text"
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                value={methodFilterDraft}
                onChange={(event) => {
                  setMethodFilterDraft(event.target.value);
                }}
                placeholder="item/started"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="debug-coverage-item-lifecycle-notifications-method-filter-clear"
                disabled={methodFilterDraft.length === 0}
                onClick={() => {
                  setMethodFilterDraft("");
                }}
              >
                Clear
              </Button>
            </div>
          </div>
          {lastItemLifecycleNotificationsResult.methodCounts.length === 0 ? (
            <p className="text-xs text-muted-foreground">Method counts: none captured.</p>
          ) : (
            <div className="space-y-1">
              <p>Method counts:</p>
              <div className="flex flex-wrap gap-2">
                {lastItemLifecycleNotificationsResult.methodCounts.map((methodCount) => (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    key={methodCount.method}
                    data-testid={`debug-coverage-item-lifecycle-notifications-method-count-${methodCount.method.replaceAll("/", "-")}`}
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
          <p data-testid="debug-coverage-item-lifecycle-notifications-filter-summary">
            Showing {String(filteredEvents.length)} of{" "}
            {String(lastItemLifecycleNotificationsResult.eventCount)} item-lifecycle notifications
            {normalizedThreadFilter.length > 0 ? ` for thread "${threadFilterDraft}"` : ""}
            {normalizedMethodFilter.length > 0 ? ` matching method "${methodFilterDraft}"` : ""}.
          </p>
          {filteredEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {lastItemLifecycleNotificationsResult.eventCount === 0
                ? "No item-lifecycle notifications were returned."
                : "No item-lifecycle notifications match the current filters."}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredEvents.map((event) => (
                <div
                  key={`${event.method}-${String(event.sequence)}`}
                  className="rounded border border-border/60 bg-background/50 p-2 space-y-1"
                  data-testid={`debug-coverage-item-lifecycle-notification-${String(event.sequence)}`}
                >
                  <p>
                    {event.method} • threadId={event.threadId} • turnId={event.turnId}
                  </p>
                  <p className="text-muted-foreground">
                    itemId={event.itemId} • itemType={event.itemType}
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

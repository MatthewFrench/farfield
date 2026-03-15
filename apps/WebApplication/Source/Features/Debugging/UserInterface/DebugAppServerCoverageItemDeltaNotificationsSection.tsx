import { useState } from "react";
import { Button } from "@/Components/UserInterface/Button";
import { type DebugAppServerCoverageItemDeltaNotificationsResult } from "../DomainModel/DebugAppServerCoverageContracts";

export interface DebugAppServerCoverageItemDeltaNotificationsSectionProps {
  isRunningCoverageAction: boolean;
  lastItemDeltaNotificationsResult: DebugAppServerCoverageItemDeltaNotificationsResult | null;
  onReadItemDeltaNotifications: (sinceSequence?: number | null) => void;
}

/**
 * Owns item-delta notification diagnostics.
 * Operators use this to inspect streamed deltas for agent messages, plans, reasoning, commands, and file changes.
 */
export function DebugAppServerCoverageItemDeltaNotificationsSection({
  isRunningCoverageAction,
  lastItemDeltaNotificationsResult,
  onReadItemDeltaNotifications,
}: DebugAppServerCoverageItemDeltaNotificationsSectionProps): React.JSX.Element {
  const [sinceSequenceDraft, setSinceSequenceDraft] = useState("");
  const [threadFilterDraft, setThreadFilterDraft] = useState("");
  const [methodFilterDraft, setMethodFilterDraft] = useState("");
  const [itemFilterDraft, setItemFilterDraft] = useState("");
  const normalizedThreadFilter = threadFilterDraft.trim().toLowerCase();
  const normalizedMethodFilter = methodFilterDraft.trim().toLowerCase();
  const normalizedItemFilter = itemFilterDraft.trim().toLowerCase();

  const runItemDeltaNotificationsRead = (): void => {
    const normalizedSinceSequence = sinceSequenceDraft.trim();
    if (normalizedSinceSequence.length === 0) {
      onReadItemDeltaNotifications(null);
      return;
    }

    const parsedSinceSequence = Number(normalizedSinceSequence);
    if (!Number.isInteger(parsedSinceSequence) || parsedSinceSequence < 0) {
      return;
    }

    onReadItemDeltaNotifications(parsedSinceSequence);
  };

  const filteredEvents =
    lastItemDeltaNotificationsResult === null
      ? []
      : lastItemDeltaNotificationsResult.events.filter((event) => {
          const matchesThread =
            normalizedThreadFilter.length === 0 ||
            event.threadId.toLowerCase().includes(normalizedThreadFilter);
          const matchesMethod =
            normalizedMethodFilter.length === 0 ||
            event.method.toLowerCase().includes(normalizedMethodFilter);
          const matchesItem =
            normalizedItemFilter.length === 0 ||
            event.itemId.toLowerCase().includes(normalizedItemFilter);
          return matchesThread && matchesMethod && matchesItem;
        });

  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Item Delta Notifications
        </h4>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="debug-coverage-item-delta-notifications-read-next-cursor"
            disabled={isRunningCoverageAction || lastItemDeltaNotificationsResult === null}
            onClick={() => {
              if (lastItemDeltaNotificationsResult === null) {
                return;
              }
              onReadItemDeltaNotifications(lastItemDeltaNotificationsResult.nextSequence);
            }}
          >
            Read From Next Cursor
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="debug-coverage-item-delta-notifications-read"
            disabled={isRunningCoverageAction}
            onClick={runItemDeltaNotificationsRead}
          >
            Read Item Deltas
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <label
          className="text-xs text-muted-foreground"
          htmlFor="debug-coverage-item-delta-notifications-since-sequence"
        >
          Since sequence (optional)
        </label>
        <input
          id="debug-coverage-item-delta-notifications-since-sequence"
          data-testid="debug-coverage-item-delta-notifications-since-sequence"
          type="text"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
          value={sinceSequenceDraft}
          onChange={(event) => {
            setSinceSequenceDraft(event.target.value);
          }}
          placeholder="0"
        />
      </div>
      {lastItemDeltaNotificationsResult === null ? (
        <p className="text-xs text-muted-foreground">No item-delta notifications captured.</p>
      ) : (
        <div
          className="rounded border border-border/70 p-2 text-xs space-y-2"
          data-testid="debug-coverage-item-delta-notifications-result"
        >
          <p>
            Item-delta notifications returned: {lastItemDeltaNotificationsResult.eventCount} •
            detail chars={String(lastItemDeltaNotificationsResult.totalDetailCharacterCount)}
          </p>
          <p>
            Cursor: next={String(lastItemDeltaNotificationsResult.nextSequence)} • firstAvailable=
            {String(lastItemDeltaNotificationsResult.firstAvailableSequence)} • resetRequired=
            {lastItemDeltaNotificationsResult.resetRequired ? "true" : "false"}
          </p>
          {lastItemDeltaNotificationsResult.resetRequired ? (
            <div className="rounded border border-amber-400/60 bg-amber-50/40 p-2 text-xs space-y-2">
              <p>Cursor indicates a dropped range. Read without since-sequence to resync.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="debug-coverage-item-delta-notifications-read-reset"
                disabled={isRunningCoverageAction}
                onClick={() => {
                  onReadItemDeltaNotifications(null);
                }}
              >
                Read Without Cursor
              </Button>
            </div>
          ) : null}
          <p>
            Since sequence used:{" "}
            {lastItemDeltaNotificationsResult.sinceSequence === null
              ? "none"
              : String(lastItemDeltaNotificationsResult.sinceSequence)}
          </p>
          <p>
            Read at: {new Date(lastItemDeltaNotificationsResult.readAtIso8601).toLocaleTimeString()}
          </p>
          <div className="space-y-2">
            <label
              className="text-xs text-muted-foreground"
              htmlFor="debug-coverage-item-delta-notifications-thread-filter"
            >
              Thread filter (optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="debug-coverage-item-delta-notifications-thread-filter"
                data-testid="debug-coverage-item-delta-notifications-thread-filter"
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
                data-testid="debug-coverage-item-delta-notifications-thread-filter-clear"
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
              htmlFor="debug-coverage-item-delta-notifications-method-filter"
            >
              Method filter (optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="debug-coverage-item-delta-notifications-method-filter"
                data-testid="debug-coverage-item-delta-notifications-method-filter"
                type="text"
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                value={methodFilterDraft}
                onChange={(event) => {
                  setMethodFilterDraft(event.target.value);
                }}
                placeholder="item/agentMessage/delta"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="debug-coverage-item-delta-notifications-method-filter-clear"
                disabled={methodFilterDraft.length === 0}
                onClick={() => {
                  setMethodFilterDraft("");
                }}
              >
                Clear
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <label
              className="text-xs text-muted-foreground"
              htmlFor="debug-coverage-item-delta-notifications-item-filter"
            >
              Item filter (optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="debug-coverage-item-delta-notifications-item-filter"
                data-testid="debug-coverage-item-delta-notifications-item-filter"
                type="text"
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                value={itemFilterDraft}
                onChange={(event) => {
                  setItemFilterDraft(event.target.value);
                }}
                placeholder="item-123"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="debug-coverage-item-delta-notifications-item-filter-clear"
                disabled={itemFilterDraft.length === 0}
                onClick={() => {
                  setItemFilterDraft("");
                }}
              >
                Clear
              </Button>
            </div>
          </div>
          {lastItemDeltaNotificationsResult.methodCounts.length === 0 ? (
            <p className="text-xs text-muted-foreground">Method counts: none captured.</p>
          ) : (
            <div className="space-y-1">
              <p>Method counts:</p>
              <div className="flex flex-wrap gap-2">
                {lastItemDeltaNotificationsResult.methodCounts.map((methodCount) => (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    key={methodCount.method}
                    data-testid={`debug-coverage-item-delta-notifications-method-count-${methodCount.method.replaceAll("/", "-")}`}
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
          <p data-testid="debug-coverage-item-delta-notifications-filter-summary">
            Showing {String(filteredEvents.length)} of{" "}
            {String(lastItemDeltaNotificationsResult.eventCount)} item-delta notifications
            {normalizedThreadFilter.length > 0 ? ` for thread "${threadFilterDraft}"` : ""}
            {normalizedMethodFilter.length > 0 ? ` matching method "${methodFilterDraft}"` : ""}
            {normalizedItemFilter.length > 0 ? ` for item "${itemFilterDraft}"` : ""}.
          </p>
          {filteredEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {lastItemDeltaNotificationsResult.eventCount === 0
                ? "No item-delta notifications were returned."
                : "No item-delta notifications match the current filters."}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredEvents.map((event) => (
                <div
                  key={`${event.method}-${String(event.sequence)}`}
                  className="rounded border border-border/60 bg-background/50 p-2 space-y-1"
                  data-testid={`debug-coverage-item-delta-notification-${String(event.sequence)}`}
                >
                  <p>
                    {event.method} • threadId={event.threadId} • turnId={event.turnId} • itemId=
                    {event.itemId}
                  </p>
                  <p className="text-muted-foreground">
                    detailIndex={event.detailIndex === null ? "(none)" : String(event.detailIndex)}
                    {" • "}processId={event.processId ?? "(none)"}
                  </p>
                  <p className="text-muted-foreground break-words">
                    Detail: {event.detailText.length === 0 ? "(empty)" : event.detailText}
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

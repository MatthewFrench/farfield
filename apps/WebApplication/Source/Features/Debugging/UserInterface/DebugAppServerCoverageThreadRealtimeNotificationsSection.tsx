import { useState } from "react";
import { Button } from "@/Components/UserInterface/Button";
import { type DebugAppServerCoverageThreadRealtimeNotificationsResult } from "../DomainModel/DebugAppServerCoverageThreadRealtimeNotificationContracts";

export interface DebugAppServerCoverageThreadRealtimeNotificationsSectionProps {
  isRunningCoverageAction: boolean;
  lastThreadRealtimeNotificationsResult: DebugAppServerCoverageThreadRealtimeNotificationsResult | null;
  onReadThreadRealtimeNotifications: (sinceSequence?: number | null) => void;
}

/**
 * Owns thread-realtime notification diagnostics.
 * Operators use this to validate realtime start/item/audio/error/close notification propagation.
 */
export function DebugAppServerCoverageThreadRealtimeNotificationsSection({
  isRunningCoverageAction,
  lastThreadRealtimeNotificationsResult,
  onReadThreadRealtimeNotifications,
}: DebugAppServerCoverageThreadRealtimeNotificationsSectionProps): React.JSX.Element {
  const [sinceSequenceDraft, setSinceSequenceDraft] = useState("");
  const [threadFilterDraft, setThreadFilterDraft] = useState("");
  const [methodFilterDraft, setMethodFilterDraft] = useState("");
  const normalizedThreadFilter = threadFilterDraft.trim().toLowerCase();
  const normalizedMethodFilter = methodFilterDraft.trim().toLowerCase();

  const runThreadRealtimeNotificationsRead = (): void => {
    const normalizedSinceSequence = sinceSequenceDraft.trim();
    if (normalizedSinceSequence.length === 0) {
      onReadThreadRealtimeNotifications(null);
      return;
    }

    const parsedSinceSequence = Number(normalizedSinceSequence);
    if (!Number.isInteger(parsedSinceSequence) || parsedSinceSequence < 0) {
      return;
    }

    onReadThreadRealtimeNotifications(parsedSinceSequence);
  };

  const filteredEvents =
    lastThreadRealtimeNotificationsResult === null
      ? []
      : lastThreadRealtimeNotificationsResult.events.filter((event) => {
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
          Thread Realtime Notifications
        </h4>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="debug-coverage-thread-realtime-notifications-read-next-cursor"
            disabled={isRunningCoverageAction || lastThreadRealtimeNotificationsResult === null}
            onClick={() => {
              if (lastThreadRealtimeNotificationsResult === null) {
                return;
              }
              onReadThreadRealtimeNotifications(lastThreadRealtimeNotificationsResult.nextSequence);
            }}
          >
            Read From Next Cursor
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="debug-coverage-thread-realtime-notifications-read"
            disabled={isRunningCoverageAction}
            onClick={runThreadRealtimeNotificationsRead}
          >
            Read Thread Realtime
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <label
          className="text-xs text-muted-foreground"
          htmlFor="debug-coverage-thread-realtime-notifications-since-sequence"
        >
          Since sequence (optional)
        </label>
        <input
          id="debug-coverage-thread-realtime-notifications-since-sequence"
          data-testid="debug-coverage-thread-realtime-notifications-since-sequence"
          type="text"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
          value={sinceSequenceDraft}
          onChange={(event) => {
            setSinceSequenceDraft(event.target.value);
          }}
          placeholder="0"
        />
      </div>
      {lastThreadRealtimeNotificationsResult === null ? (
        <p className="text-xs text-muted-foreground">No thread-realtime notifications captured.</p>
      ) : (
        <div
          className="rounded border border-border/70 p-2 text-xs space-y-2"
          data-testid="debug-coverage-thread-realtime-notifications-result"
        >
          <p>
            Thread-realtime notifications returned:{" "}
            {lastThreadRealtimeNotificationsResult.eventCount}
          </p>
          <p>
            Cursor: next={String(lastThreadRealtimeNotificationsResult.nextSequence)} •
            firstAvailable={String(lastThreadRealtimeNotificationsResult.firstAvailableSequence)} •
            resetRequired=
            {lastThreadRealtimeNotificationsResult.resetRequired ? "true" : "false"}
          </p>
          {lastThreadRealtimeNotificationsResult.resetRequired ? (
            <div className="rounded border border-amber-400/60 bg-amber-50/40 p-2 text-xs space-y-2">
              <p>Cursor indicates a dropped range. Read without since-sequence to resync.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="debug-coverage-thread-realtime-notifications-read-reset"
                disabled={isRunningCoverageAction}
                onClick={() => {
                  onReadThreadRealtimeNotifications(null);
                }}
              >
                Read Without Cursor
              </Button>
            </div>
          ) : null}
          <p>
            Since sequence used:{" "}
            {lastThreadRealtimeNotificationsResult.sinceSequence === null
              ? "none"
              : String(lastThreadRealtimeNotificationsResult.sinceSequence)}
          </p>
          <p>
            Read at:{" "}
            {new Date(lastThreadRealtimeNotificationsResult.readAtIso8601).toLocaleTimeString()}
          </p>
          <div className="space-y-2">
            <label
              className="text-xs text-muted-foreground"
              htmlFor="debug-coverage-thread-realtime-notifications-thread-filter"
            >
              Thread filter (optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="debug-coverage-thread-realtime-notifications-thread-filter"
                data-testid="debug-coverage-thread-realtime-notifications-thread-filter"
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
                data-testid="debug-coverage-thread-realtime-notifications-thread-filter-clear"
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
              htmlFor="debug-coverage-thread-realtime-notifications-method-filter"
            >
              Method filter (optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="debug-coverage-thread-realtime-notifications-method-filter"
                data-testid="debug-coverage-thread-realtime-notifications-method-filter"
                type="text"
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                value={methodFilterDraft}
                onChange={(event) => {
                  setMethodFilterDraft(event.target.value);
                }}
                placeholder="thread/realtime/started"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="debug-coverage-thread-realtime-notifications-method-filter-clear"
                disabled={methodFilterDraft.length === 0}
                onClick={() => {
                  setMethodFilterDraft("");
                }}
              >
                Clear
              </Button>
            </div>
          </div>
          {lastThreadRealtimeNotificationsResult.methodCounts.length === 0 ? (
            <p className="text-xs text-muted-foreground">Method counts: none captured.</p>
          ) : (
            <div className="space-y-1">
              <p>Method counts:</p>
              <div className="flex flex-wrap gap-2">
                {lastThreadRealtimeNotificationsResult.methodCounts.map((methodCount) => (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    key={methodCount.method}
                    data-testid={`debug-coverage-thread-realtime-notifications-method-count-${methodCount.method.replaceAll("/", "-")}`}
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
          <p data-testid="debug-coverage-thread-realtime-notifications-filter-summary">
            Showing {String(filteredEvents.length)} of{" "}
            {String(lastThreadRealtimeNotificationsResult.eventCount)} thread-realtime notifications
            {normalizedThreadFilter.length > 0 ? ` for thread "${threadFilterDraft}"` : ""}
            {normalizedMethodFilter.length > 0 ? ` matching method "${methodFilterDraft}"` : ""}.
          </p>
          {filteredEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {lastThreadRealtimeNotificationsResult.eventCount === 0
                ? "No thread-realtime notifications were returned."
                : "No thread-realtime notifications match the current filters."}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredEvents.map((event) => (
                <div
                  key={`${event.method}-${String(event.sequence)}`}
                  className="rounded border border-border/60 bg-background/50 p-2 space-y-1"
                  data-testid={`debug-coverage-thread-realtime-notification-${String(event.sequence)}`}
                >
                  <p>
                    {event.method} • threadId={event.threadId}
                  </p>
                  <p className="text-muted-foreground">
                    sessionId={event.sessionId ?? "(none)"} • error=
                    {event.errorMessage ?? "(none)"} • closeReason=
                    {event.closeReason ?? "(none)"}
                  </p>
                  <p className="text-muted-foreground">
                    audio(chars/sampleRate/channels/samplesPerChannel)=
                    {event.audioDataLength === null ? "(none)" : String(event.audioDataLength)}/
                    {event.audioSampleRate === null ? "(none)" : String(event.audioSampleRate)}/
                    {event.audioNumChannels === null ? "(none)" : String(event.audioNumChannels)}/
                    {event.audioSamplesPerChannel === null
                      ? "(none)"
                      : String(event.audioSamplesPerChannel)}
                  </p>
                  <p className="text-muted-foreground break-words">
                    Item: {event.itemPreview ?? "(none)"}
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

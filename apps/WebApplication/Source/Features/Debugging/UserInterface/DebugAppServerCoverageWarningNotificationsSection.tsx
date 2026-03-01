import { useState } from "react";
import { Button } from "@/Components/UserInterface/Button";
import { type DebugAppServerCoverageWarningNotificationsResult } from "../DomainModel/DebugAppServerCoverageContracts";

export interface DebugAppServerCoverageWarningNotificationsSectionProps {
  isRunningCoverageAction: boolean;
  lastWarningNotificationsResult: DebugAppServerCoverageWarningNotificationsResult | null;
  onReadWarningNotifications: (sinceSequence?: number | null) => void;
}

/**
 * Owns warning-class notification diagnostics for config, deprecation, and world-writable alerts.
 * Operators use this to verify warning surfaces that affect setup and security posture.
 */
export function DebugAppServerCoverageWarningNotificationsSection({
  isRunningCoverageAction,
  lastWarningNotificationsResult,
  onReadWarningNotifications,
}: DebugAppServerCoverageWarningNotificationsSectionProps): React.JSX.Element {
  const [sinceSequenceDraft, setSinceSequenceDraft] = useState("");
  const [methodFilterDraft, setMethodFilterDraft] = useState("");
  const normalizedMethodFilter = methodFilterDraft.trim().toLowerCase();

  const runWarningNotificationsRead = (): void => {
    const normalizedSinceSequence = sinceSequenceDraft.trim();
    if (normalizedSinceSequence.length === 0) {
      onReadWarningNotifications(null);
      return;
    }

    const parsedSinceSequence = Number(normalizedSinceSequence);
    if (!Number.isInteger(parsedSinceSequence) || parsedSinceSequence < 0) {
      return;
    }

    onReadWarningNotifications(parsedSinceSequence);
  };

  const filteredEvents =
    lastWarningNotificationsResult === null
      ? []
      : lastWarningNotificationsResult.events.filter((event) =>
          event.method.toLowerCase().includes(normalizedMethodFilter),
        );

  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Warning Notifications
        </h4>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="debug-coverage-warning-notifications-read-next-cursor"
            disabled={isRunningCoverageAction || lastWarningNotificationsResult === null}
            onClick={() => {
              if (lastWarningNotificationsResult === null) {
                return;
              }
              onReadWarningNotifications(lastWarningNotificationsResult.nextSequence);
            }}
          >
            Read From Next Cursor
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="debug-coverage-warning-notifications-read"
            disabled={isRunningCoverageAction}
            onClick={runWarningNotificationsRead}
          >
            Read Warnings
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <label
          className="text-xs text-muted-foreground"
          htmlFor="debug-coverage-warning-notifications-since-sequence"
        >
          Since sequence (optional)
        </label>
        <input
          id="debug-coverage-warning-notifications-since-sequence"
          data-testid="debug-coverage-warning-notifications-since-sequence"
          type="text"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
          value={sinceSequenceDraft}
          onChange={(event) => {
            setSinceSequenceDraft(event.target.value);
          }}
          placeholder="0"
        />
      </div>
      {lastWarningNotificationsResult === null ? (
        <p className="text-xs text-muted-foreground">No warning notifications captured.</p>
      ) : (
        <div
          className="rounded border border-border/70 p-2 text-xs space-y-2"
          data-testid="debug-coverage-warning-notifications-result"
        >
          <p>Warning notifications returned: {lastWarningNotificationsResult.eventCount}</p>
          <p>
            Cursor: next={String(lastWarningNotificationsResult.nextSequence)} • firstAvailable=
            {String(lastWarningNotificationsResult.firstAvailableSequence)} • resetRequired=
            {lastWarningNotificationsResult.resetRequired ? "true" : "false"}
          </p>
          {lastWarningNotificationsResult.resetRequired ? (
            <div className="rounded border border-amber-400/60 bg-amber-50/40 p-2 text-xs space-y-2">
              <p>Cursor indicates a dropped range. Read without since-sequence to resync.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="debug-coverage-warning-notifications-read-reset"
                disabled={isRunningCoverageAction}
                onClick={() => {
                  onReadWarningNotifications(null);
                }}
              >
                Read Without Cursor
              </Button>
            </div>
          ) : null}
          <p>
            Since sequence used:{" "}
            {lastWarningNotificationsResult.sinceSequence === null
              ? "none"
              : String(lastWarningNotificationsResult.sinceSequence)}
          </p>
          <p>
            Read at: {new Date(lastWarningNotificationsResult.readAtIso8601).toLocaleTimeString()}
          </p>
          <div className="space-y-2">
            <label
              className="text-xs text-muted-foreground"
              htmlFor="debug-coverage-warning-notifications-method-filter"
            >
              Method filter (optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="debug-coverage-warning-notifications-method-filter"
                data-testid="debug-coverage-warning-notifications-method-filter"
                type="text"
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                value={methodFilterDraft}
                onChange={(event) => {
                  setMethodFilterDraft(event.target.value);
                }}
                placeholder="configWarning"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="debug-coverage-warning-notifications-method-filter-clear"
                disabled={methodFilterDraft.length === 0}
                onClick={() => {
                  setMethodFilterDraft("");
                }}
              >
                Clear
              </Button>
            </div>
          </div>
          {lastWarningNotificationsResult.methodCounts.length === 0 ? (
            <p className="text-xs text-muted-foreground">Method counts: none captured.</p>
          ) : (
            <div className="space-y-1">
              <p>Method counts:</p>
              <div className="flex flex-wrap gap-2">
                {lastWarningNotificationsResult.methodCounts.map((methodCount) => (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    key={methodCount.method}
                    data-testid={`debug-coverage-warning-notifications-method-count-${methodCount.method.replaceAll("/", "-")}`}
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
          <p data-testid="debug-coverage-warning-notifications-filter-summary">
            Showing {String(filteredEvents.length)} of{" "}
            {String(lastWarningNotificationsResult.eventCount)} warning notifications
            {normalizedMethodFilter.length > 0 ? ` matching "${methodFilterDraft}"` : ""}.
          </p>
          {filteredEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {lastWarningNotificationsResult.eventCount === 0
                ? "No warning notifications were returned."
                : "No warning notifications match the current method filter."}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredEvents.map((event) => (
                <div
                  key={`${event.method}-${String(event.sequence)}`}
                  className="rounded border border-border/60 bg-background/50 p-2 space-y-1"
                  data-testid={`debug-coverage-warning-notification-${String(event.sequence)}`}
                >
                  <p>{event.method}</p>
                  {event.method === "configWarning" ? (
                    <>
                      <p className="text-muted-foreground">{event.summary}</p>
                      {event.details === null ? null : (
                        <p className="text-muted-foreground">Details: {event.details}</p>
                      )}
                      {event.path === null ? null : (
                        <p className="text-muted-foreground">Path: {event.path}</p>
                      )}
                      {event.range === null ? null : (
                        <p className="text-muted-foreground">
                          Range: {String(event.range.start.line)}:{String(event.range.start.column)}{" "}
                          - {String(event.range.end.line)}:{String(event.range.end.column)}
                        </p>
                      )}
                    </>
                  ) : null}
                  {event.method === "deprecationNotice" ? (
                    <>
                      <p className="text-muted-foreground">{event.summary}</p>
                      {event.details === null ? null : (
                        <p className="text-muted-foreground">Details: {event.details}</p>
                      )}
                    </>
                  ) : null}
                  {event.method === "windows/worldWritableWarning" ? (
                    <>
                      <p className="text-muted-foreground">
                        Sample paths:{" "}
                        {event.samplePaths.length === 0 ? "(none)" : event.samplePaths.join(", ")}
                      </p>
                      <p className="text-muted-foreground">
                        extraCount={String(event.extraCount)} • failedScan=
                        {event.failedScan ? "true" : "false"}
                      </p>
                    </>
                  ) : null}
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

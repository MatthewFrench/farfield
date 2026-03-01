import { useState } from "react";
import { Button } from "@/Components/UserInterface/Button";
import { type DebugAppServerCoverageAccountAndAppNotificationsResult } from "../DomainModel/DebugAppServerCoverageAccountAndAppNotificationContracts";

export interface DebugAppServerCoverageAccountAndAppNotificationsSectionProps {
  isRunningCoverageAction: boolean;
  lastAccountAndAppNotificationsResult: DebugAppServerCoverageAccountAndAppNotificationsResult | null;
  onReadAccountAndAppNotifications: (sinceSequence?: number | null) => void;
}

/**
 * Owns account/app/windows update notification diagnostics.
 * Operators use this to validate account/app list changes and sandbox setup completion notifications.
 */
export function DebugAppServerCoverageAccountAndAppNotificationsSection({
  isRunningCoverageAction,
  lastAccountAndAppNotificationsResult,
  onReadAccountAndAppNotifications,
}: DebugAppServerCoverageAccountAndAppNotificationsSectionProps): React.JSX.Element {
  const [sinceSequenceDraft, setSinceSequenceDraft] = useState("");
  const [methodFilterDraft, setMethodFilterDraft] = useState("");
  const normalizedMethodFilter = methodFilterDraft.trim().toLowerCase();

  const runAccountAndAppNotificationsRead = (): void => {
    const normalizedSinceSequence = sinceSequenceDraft.trim();
    if (normalizedSinceSequence.length === 0) {
      onReadAccountAndAppNotifications(null);
      return;
    }

    const parsedSinceSequence = Number(normalizedSinceSequence);
    if (!Number.isInteger(parsedSinceSequence) || parsedSinceSequence < 0) {
      return;
    }

    onReadAccountAndAppNotifications(parsedSinceSequence);
  };

  const filteredEvents =
    lastAccountAndAppNotificationsResult === null
      ? []
      : lastAccountAndAppNotificationsResult.events.filter((event) => {
          if (normalizedMethodFilter.length === 0) {
            return true;
          }
          return event.method.toLowerCase().includes(normalizedMethodFilter);
        });

  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Account, App, and Sandbox Notifications
        </h4>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="debug-coverage-account-app-notifications-read-next-cursor"
            disabled={isRunningCoverageAction || lastAccountAndAppNotificationsResult === null}
            onClick={() => {
              if (lastAccountAndAppNotificationsResult === null) {
                return;
              }
              onReadAccountAndAppNotifications(lastAccountAndAppNotificationsResult.nextSequence);
            }}
          >
            Read From Next Cursor
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="debug-coverage-account-app-notifications-read"
            disabled={isRunningCoverageAction}
            onClick={runAccountAndAppNotificationsRead}
          >
            Read Account/App Updates
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <label
          className="text-xs text-muted-foreground"
          htmlFor="debug-coverage-account-app-notifications-since-sequence"
        >
          Since sequence (optional)
        </label>
        <input
          id="debug-coverage-account-app-notifications-since-sequence"
          data-testid="debug-coverage-account-app-notifications-since-sequence"
          type="text"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
          value={sinceSequenceDraft}
          onChange={(event) => {
            setSinceSequenceDraft(event.target.value);
          }}
          placeholder="0"
        />
      </div>
      {lastAccountAndAppNotificationsResult === null ? (
        <p className="text-xs text-muted-foreground">
          No account/app/sandbox notifications captured.
        </p>
      ) : (
        <div
          className="rounded border border-border/70 p-2 text-xs space-y-2"
          data-testid="debug-coverage-account-app-notifications-result"
        >
          <p>
            Account/app/sandbox notifications returned:{" "}
            {lastAccountAndAppNotificationsResult.eventCount}
          </p>
          <p>
            Cursor: next={String(lastAccountAndAppNotificationsResult.nextSequence)} •
            firstAvailable={String(lastAccountAndAppNotificationsResult.firstAvailableSequence)} •
            resetRequired=
            {lastAccountAndAppNotificationsResult.resetRequired ? "true" : "false"}
          </p>
          {lastAccountAndAppNotificationsResult.resetRequired ? (
            <div className="rounded border border-amber-400/60 bg-amber-50/40 p-2 text-xs space-y-2">
              <p>Cursor indicates a dropped range. Read without since-sequence to resync.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="debug-coverage-account-app-notifications-read-reset"
                disabled={isRunningCoverageAction}
                onClick={() => {
                  onReadAccountAndAppNotifications(null);
                }}
              >
                Read Without Cursor
              </Button>
            </div>
          ) : null}
          <p>
            Since sequence used:{" "}
            {lastAccountAndAppNotificationsResult.sinceSequence === null
              ? "none"
              : String(lastAccountAndAppNotificationsResult.sinceSequence)}
          </p>
          <p>
            Read at:{" "}
            {new Date(lastAccountAndAppNotificationsResult.readAtIso8601).toLocaleTimeString()}
          </p>
          <div className="space-y-2">
            <label
              className="text-xs text-muted-foreground"
              htmlFor="debug-coverage-account-app-notifications-method-filter"
            >
              Method filter (optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="debug-coverage-account-app-notifications-method-filter"
                data-testid="debug-coverage-account-app-notifications-method-filter"
                type="text"
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                value={methodFilterDraft}
                onChange={(event) => {
                  setMethodFilterDraft(event.target.value);
                }}
                placeholder="account/updated"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="debug-coverage-account-app-notifications-method-filter-clear"
                disabled={methodFilterDraft.length === 0}
                onClick={() => {
                  setMethodFilterDraft("");
                }}
              >
                Clear
              </Button>
            </div>
          </div>
          {lastAccountAndAppNotificationsResult.methodCounts.length === 0 ? (
            <p className="text-xs text-muted-foreground">Method counts: none captured.</p>
          ) : (
            <div className="space-y-1">
              <p>Method counts:</p>
              <div className="flex flex-wrap gap-2">
                {lastAccountAndAppNotificationsResult.methodCounts.map((methodCount) => (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    key={methodCount.method}
                    data-testid={`debug-coverage-account-app-notifications-method-count-${methodCount.method.replaceAll("/", "-")}`}
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
          <p data-testid="debug-coverage-account-app-notifications-filter-summary">
            Showing {String(filteredEvents.length)} of{" "}
            {String(lastAccountAndAppNotificationsResult.eventCount)} account/app/sandbox
            notifications
            {normalizedMethodFilter.length > 0 ? ` matching method "${methodFilterDraft}"` : ""}.
          </p>
          {filteredEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {lastAccountAndAppNotificationsResult.eventCount === 0
                ? "No account/app/sandbox notifications were returned."
                : "No account/app/sandbox notifications match the current filters."}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredEvents.map((event) => (
                <div
                  key={`${event.method}-${String(event.sequence)}`}
                  className="rounded border border-border/60 bg-background/50 p-2 space-y-1"
                  data-testid={`debug-coverage-account-app-notification-${String(event.sequence)}`}
                >
                  <p>{event.method}</p>
                  <p className="text-muted-foreground">
                    authMode={event.authMode ?? "(none)"} • appCount=
                    {event.appCount === null ? "(none)" : String(event.appCount)} • planType=
                    {event.rateLimitPlanType ?? "(none)"}
                  </p>
                  <p className="text-muted-foreground">
                    rateLimit={event.rateLimitName ?? "(none)"} • sandboxMode=
                    {event.windowsSandboxMode ?? "(none)"} • sandboxSuccess=
                    {event.windowsSandboxSuccess === null
                      ? "(none)"
                      : event.windowsSandboxSuccess
                        ? "true"
                        : "false"}
                  </p>
                  <p className="text-muted-foreground break-words">
                    sandboxError={event.windowsSandboxError ?? "(none)"}
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

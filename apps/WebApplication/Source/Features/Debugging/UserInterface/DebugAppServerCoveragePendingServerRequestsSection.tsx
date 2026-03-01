import { useState } from "react";
import { Button } from "@/Components/UserInterface/Button";
import { type DebugAppServerCoveragePendingServerRequestsResult } from "../DomainModel/DebugAppServerCoverageContracts";

export interface DebugAppServerCoveragePendingServerRequestsSectionProps {
  isRunningCoverageAction: boolean;
  lastPendingServerRequestsResult: DebugAppServerCoveragePendingServerRequestsResult | null;
  onReadPendingServerRequests: () => void;
}

/**
 * Owns pending server-request diagnostics controls for coverage verification.
 * Operators use this section to inspect unresolved server requests and payload previews.
 */
export function DebugAppServerCoveragePendingServerRequestsSection({
  isRunningCoverageAction,
  lastPendingServerRequestsResult,
  onReadPendingServerRequests,
}: DebugAppServerCoveragePendingServerRequestsSectionProps): React.JSX.Element {
  const [methodFilterDraft, setMethodFilterDraft] = useState("");
  const normalizedMethodFilter = methodFilterDraft.trim().toLowerCase();

  const filteredRequests =
    lastPendingServerRequestsResult === null
      ? []
      : lastPendingServerRequestsResult.requests.filter((request) =>
          request.method.toLowerCase().includes(normalizedMethodFilter),
        );

  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Pending Server Requests
        </h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="debug-coverage-pending-server-requests-read"
          disabled={isRunningCoverageAction}
          onClick={onReadPendingServerRequests}
        >
          Read Pending Requests
        </Button>
      </div>
      {lastPendingServerRequestsResult === null ? (
        <p className="text-xs text-muted-foreground">
          No pending server-request diagnostics captured.
        </p>
      ) : (
        <div
          className="rounded border border-border/70 p-2 text-xs space-y-2"
          data-testid="debug-coverage-pending-server-requests-result"
        >
          <p>Pending requests: {lastPendingServerRequestsResult.requestCount}</p>
          <p>
            Read at: {new Date(lastPendingServerRequestsResult.readAtIso8601).toLocaleTimeString()}
          </p>
          <div className="space-y-2">
            <label
              className="text-xs text-muted-foreground"
              htmlFor="debug-coverage-pending-server-requests-method-filter"
            >
              Method filter (optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="debug-coverage-pending-server-requests-method-filter"
                data-testid="debug-coverage-pending-server-requests-method-filter"
                type="text"
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                value={methodFilterDraft}
                onChange={(event) => {
                  setMethodFilterDraft(event.target.value);
                }}
                placeholder="item/tool/requestUserInput"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="debug-coverage-pending-server-requests-method-filter-clear"
                disabled={methodFilterDraft.length === 0}
                onClick={() => {
                  setMethodFilterDraft("");
                }}
              >
                Clear
              </Button>
            </div>
          </div>
          {lastPendingServerRequestsResult.methodCounts.length === 0 ? (
            <p className="text-xs text-muted-foreground">Method counts: none captured.</p>
          ) : (
            <div className="space-y-1">
              <p>Method counts:</p>
              <div className="flex flex-wrap gap-2">
                {lastPendingServerRequestsResult.methodCounts.map((methodCount) => (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    key={methodCount.method}
                    data-testid={`debug-coverage-pending-server-requests-method-count-${methodCount.method.replaceAll("/", "-")}`}
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
          <p data-testid="debug-coverage-pending-server-requests-filter-summary">
            Showing {String(filteredRequests.length)} of{" "}
            {String(lastPendingServerRequestsResult.requestCount)} pending requests
            {normalizedMethodFilter.length > 0 ? ` matching "${methodFilterDraft}"` : ""}.
          </p>
          {filteredRequests.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {lastPendingServerRequestsResult.requestCount === 0
                ? "No pending server requests were returned."
                : "No pending server requests match the current method filter."}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredRequests.map((request) => (
                <div
                  key={request.requestId}
                  className="rounded border border-border/60 bg-background/50 p-2 space-y-1"
                  data-testid={`debug-coverage-pending-server-request-${String(request.requestId)}`}
                >
                  <p>
                    #{String(request.requestId)} • {request.method}
                  </p>
                  <p className="text-muted-foreground">
                    Received: {new Date(request.receivedAtMilliseconds).toLocaleTimeString()}
                  </p>
                  <pre className="rounded border border-border/60 bg-background p-2 whitespace-pre-wrap break-words">
                    {request.preview}
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

import { RefreshCcw } from "lucide-react";
import { Button } from "@/Components/UserInterface/Button";
import { type DebugAppServerCoverageSnapshot } from "../DomainModel/DebugAppServerCoverageContracts";

export interface DebugAppServerCoveragePanelProps {
  isLoadingCoverageDiagnostics: boolean;
  coverageDiagnosticsErrorMessage: string;
  coverageDiagnosticsSnapshot: DebugAppServerCoverageSnapshot | null;
  onRefreshCoverageDiagnostics: () => void;
}

function renderListValues(values: string[] | null): string {
  if (values === null || values.length === 0) {
    return "None";
  }
  return values.join(", ");
}

/**
 * Owns display of app-server coverage diagnostics used for integration debugging.
 * Rendering is intentionally compact so this panel remains scan-friendly during active troubleshooting.
 */
export function DebugAppServerCoveragePanel({
  isLoadingCoverageDiagnostics,
  coverageDiagnosticsErrorMessage,
  coverageDiagnosticsSnapshot,
  onRefreshCoverageDiagnostics,
}: DebugAppServerCoveragePanelProps): React.JSX.Element {
  return (
    <div data-testid="debug-coverage-panel" className="flex-1 min-h-0 overflow-auto p-4 space-y-3">
      <div className="rounded-md border border-border bg-card p-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">App-Server Coverage Diagnostics</h3>
          <p className="text-xs text-muted-foreground">
            Skills, apps, experimental features, MCP status, and config requirements.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="debug-coverage-refresh"
          onClick={onRefreshCoverageDiagnostics}
          disabled={isLoadingCoverageDiagnostics}
        >
          <RefreshCcw size={12} className={isLoadingCoverageDiagnostics ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {isLoadingCoverageDiagnostics && (
        <div
          data-testid="debug-coverage-loading"
          className="rounded-md border border-border bg-card p-3 text-xs text-muted-foreground"
        >
          Loading app-server coverage diagnostics...
        </div>
      )}

      {!isLoadingCoverageDiagnostics && coverageDiagnosticsErrorMessage.length > 0 && (
        <div
          data-testid="debug-coverage-error"
          className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200"
        >
          {coverageDiagnosticsErrorMessage}
        </div>
      )}

      {coverageDiagnosticsSnapshot !== null && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <div className="rounded-md border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">Skills</p>
              <p className="text-lg font-semibold">{coverageDiagnosticsSnapshot.skills.length}</p>
            </div>
            <div className="rounded-md border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">Apps</p>
              <p className="text-lg font-semibold">{coverageDiagnosticsSnapshot.apps.length}</p>
            </div>
            <div className="rounded-md border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">Experimental</p>
              <p className="text-lg font-semibold">
                {coverageDiagnosticsSnapshot.experimentalFeatures.length}
              </p>
            </div>
            <div className="rounded-md border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">MCP Servers</p>
              <p className="text-lg font-semibold">
                {coverageDiagnosticsSnapshot.mcpServers.length}
              </p>
            </div>
            <div className="rounded-md border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">Refreshed</p>
              <p className="text-sm font-medium">
                {new Date(coverageDiagnosticsSnapshot.refreshedAtIso8601).toLocaleTimeString()}
              </p>
            </div>
          </div>

          <div className="rounded-md border border-border bg-card p-3 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Config Requirements
            </h4>
            <p className="text-xs">
              Approval policies:{" "}
              {renderListValues(
                coverageDiagnosticsSnapshot.requirements?.allowedApprovalPolicies ?? null,
              )}
            </p>
            <p className="text-xs">
              Sandbox modes:{" "}
              {renderListValues(
                coverageDiagnosticsSnapshot.requirements?.allowedSandboxModes ?? null,
              )}
            </p>
            <p className="text-xs">
              Web search modes:{" "}
              {renderListValues(
                coverageDiagnosticsSnapshot.requirements?.allowedWebSearchModes ?? null,
              )}
            </p>
            <p className="text-xs">
              Residency: {coverageDiagnosticsSnapshot.requirements?.enforceResidency ?? "None"}
            </p>
          </div>

          <div className="rounded-md border border-border bg-card p-3 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Experimental Features
            </h4>
            {coverageDiagnosticsSnapshot.experimentalFeatures.length === 0 ? (
              <p className="text-xs text-muted-foreground">No experimental features reported.</p>
            ) : (
              coverageDiagnosticsSnapshot.experimentalFeatures.map((feature) => (
                <div
                  key={feature.name}
                  className="flex items-center justify-between gap-2 text-xs"
                  data-testid={`debug-coverage-feature-${feature.name}`}
                >
                  <span className="font-medium">{feature.displayName ?? feature.name}</span>
                  <span className="text-muted-foreground">{feature.stage}</span>
                </div>
              ))
            )}
          </div>

          <div className="rounded-md border border-border bg-card p-3 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              MCP Servers
            </h4>
            {coverageDiagnosticsSnapshot.mcpServers.length === 0 ? (
              <p className="text-xs text-muted-foreground">No MCP servers reported.</p>
            ) : (
              coverageDiagnosticsSnapshot.mcpServers.map((server) => (
                <div
                  key={server.name}
                  className="flex items-center justify-between gap-2 text-xs"
                  data-testid={`debug-coverage-mcp-${server.name}`}
                >
                  <span>{server.name}</span>
                  <span className="text-muted-foreground">
                    {server.toolCount} tools • {server.authStatus}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="rounded-md border border-border bg-card p-3 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Skills
            </h4>
            {coverageDiagnosticsSnapshot.skills.length === 0 ? (
              <p className="text-xs text-muted-foreground">No skills reported.</p>
            ) : (
              coverageDiagnosticsSnapshot.skills.map((entry) => (
                <div
                  key={entry.cwd}
                  className="text-xs"
                  data-testid={`debug-coverage-skills-${entry.cwd}`}
                >
                  <p className="font-medium">{entry.cwd}</p>
                  <p className="text-muted-foreground">
                    {entry.skills.length} skills • {entry.errorCount} errors
                  </p>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

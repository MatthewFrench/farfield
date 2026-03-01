import { useState } from "react";
import { Button } from "@/Components/UserInterface/Button";
import type {
  DebugAppServerCoverageExternalAgentConfigDetectResult,
  DebugAppServerCoverageExternalAgentConfigImportResult,
  DebugAppServerCoverageExternalAgentConfigMigrationItem,
} from "../DomainModel/DebugAppServerCoverageContracts";

export interface DebugAppServerCoverageExternalAgentConfigSectionProps {
  isRunningCoverageAction: boolean;
  lastExternalAgentConfigDetectResult: DebugAppServerCoverageExternalAgentConfigDetectResult | null;
  lastExternalAgentConfigImportResult: DebugAppServerCoverageExternalAgentConfigImportResult | null;
  onDetectExternalAgentConfig: (includeHome: boolean, cwds: string[]) => void;
  onImportExternalAgentConfig: (
    migrationItems: DebugAppServerCoverageExternalAgentConfigMigrationItem[],
  ) => void;
}

function readWorkingDirectoriesInputValue(inputValue: string): string[] {
  return inputValue
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

/**
 * Detects and imports external agent configuration migration items for coverage diagnostics.
 */
export function DebugAppServerCoverageExternalAgentConfigSection({
  isRunningCoverageAction,
  lastExternalAgentConfigDetectResult,
  lastExternalAgentConfigImportResult,
  onDetectExternalAgentConfig,
  onImportExternalAgentConfig,
}: DebugAppServerCoverageExternalAgentConfigSectionProps): React.JSX.Element {
  const [includeHome, setIncludeHome] = useState(true);
  const [workingDirectoriesInputValue, setWorkingDirectoriesInputValue] = useState("");

  const detectedItems = lastExternalAgentConfigDetectResult?.items ?? [];

  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        External Agent Config
      </h4>
      <p className="text-xs text-muted-foreground">
        Detect and import migration items from external agent setup surfaces.
      </p>

      <div className="grid gap-2 md:grid-cols-2">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            data-testid="debug-coverage-external-config-include-home"
            checked={includeHome}
            onChange={(event) => {
              setIncludeHome(event.target.checked);
            }}
          />
          Include home-scoped config
        </label>
        <label className="text-xs space-y-1">
          <span className="text-muted-foreground">Working directories (comma-separated)</span>
          <input
            type="text"
            value={workingDirectoriesInputValue}
            onChange={(event) => {
              setWorkingDirectoriesInputValue(event.target.value);
            }}
            placeholder="/tmp/project,/tmp/project/packages"
            data-testid="debug-coverage-external-config-cwds-input"
            className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="debug-coverage-external-config-detect-run"
          disabled={isRunningCoverageAction}
          onClick={() => {
            onDetectExternalAgentConfig(
              includeHome,
              readWorkingDirectoriesInputValue(workingDirectoriesInputValue),
            );
          }}
        >
          Detect Migration Items
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="debug-coverage-external-config-import-run"
          disabled={isRunningCoverageAction || detectedItems.length === 0}
          onClick={() => {
            onImportExternalAgentConfig(detectedItems);
          }}
        >
          Import Detected Items
        </Button>
      </div>

      {lastExternalAgentConfigDetectResult !== null && (
        <div className="space-y-1 text-xs">
          <p>
            Last detect: {String(lastExternalAgentConfigDetectResult.items.length)} items at{" "}
            {new Date(lastExternalAgentConfigDetectResult.detectedAtIso8601).toLocaleTimeString()}
          </p>
          {lastExternalAgentConfigDetectResult.items.map((migrationItem, index) => (
            <div
              key={`${migrationItem.itemType}-${migrationItem.description}-${String(index)}`}
              data-testid={`debug-coverage-external-config-item-${String(index)}`}
              className="rounded border border-border/70 p-2"
            >
              <p className="font-medium">
                {migrationItem.itemType}: {migrationItem.description}
              </p>
              <p className="text-muted-foreground">{migrationItem.cwd ?? "Home scope"}</p>
            </div>
          ))}
        </div>
      )}

      {lastExternalAgentConfigImportResult !== null && (
        <p className="text-xs" data-testid="debug-coverage-external-config-import-result">
          Last import: {String(lastExternalAgentConfigImportResult.itemCount)} items at{" "}
          {new Date(lastExternalAgentConfigImportResult.importedAtIso8601).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}

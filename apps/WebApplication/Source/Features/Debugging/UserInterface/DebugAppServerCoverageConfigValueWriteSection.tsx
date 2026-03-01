import { useState } from "react";
import { Button } from "@/Components/UserInterface/Button";
import { type DebugAppServerCoverageConfigValueWriteResult } from "../DomainModel/DebugAppServerCoverageContracts";

export interface DebugAppServerCoverageConfigValueWriteSectionProps {
  isRunningCoverageAction: boolean;
  lastConfigValueWriteResult: DebugAppServerCoverageConfigValueWriteResult | null;
  onWriteConfigValue: (
    keyPath: string,
    value: string,
    mergeStrategy: "replace" | "upsert",
    filePath?: string,
    expectedVersion?: string,
  ) => void;
}

/**
 * Owns user-input controls for config-value writes in the debug coverage surface.
 * Input values are intentionally explicit so operators can test key-path and merge strategy behavior.
 */
export function DebugAppServerCoverageConfigValueWriteSection({
  isRunningCoverageAction,
  lastConfigValueWriteResult,
  onWriteConfigValue,
}: DebugAppServerCoverageConfigValueWriteSectionProps): React.JSX.Element {
  const [configWriteKeyPath, setConfigWriteKeyPath] = useState("integrations.github");
  const [configWriteValue, setConfigWriteValue] = useState('{"enabled":true}');
  const [configWriteMergeStrategy, setConfigWriteMergeStrategy] = useState<"replace" | "upsert">(
    "upsert",
  );
  const [configWriteFilePath, setConfigWriteFilePath] = useState("");
  const [configWriteExpectedVersion, setConfigWriteExpectedVersion] = useState("");

  const runCoverageConfigWrite = (): void => {
    onWriteConfigValue(
      configWriteKeyPath,
      configWriteValue,
      configWriteMergeStrategy,
      configWriteFilePath.trim().length > 0 ? configWriteFilePath : undefined,
      configWriteExpectedVersion.trim().length > 0 ? configWriteExpectedVersion : undefined,
    );
  };

  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Config Value Write
        </h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="debug-coverage-config-value-write"
          disabled={isRunningCoverageAction}
          onClick={runCoverageConfigWrite}
        >
          Write Config
        </Button>
      </div>
      <div className="space-y-2">
        <label
          className="text-xs text-muted-foreground"
          htmlFor="debug-coverage-config-write-key-path"
        >
          Key Path
        </label>
        <input
          id="debug-coverage-config-write-key-path"
          type="text"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
          value={configWriteKeyPath}
          onChange={(event) => {
            setConfigWriteKeyPath(event.target.value);
          }}
        />
        <label
          className="text-xs text-muted-foreground"
          htmlFor="debug-coverage-config-write-value"
        >
          JSON Value
        </label>
        <textarea
          id="debug-coverage-config-write-value"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs min-h-16"
          value={configWriteValue}
          onChange={(event) => {
            setConfigWriteValue(event.target.value);
          }}
        />
        <label
          className="text-xs text-muted-foreground"
          htmlFor="debug-coverage-config-write-merge-strategy"
        >
          Merge Strategy
        </label>
        <select
          id="debug-coverage-config-write-merge-strategy"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
          value={configWriteMergeStrategy}
          onChange={(event) => {
            setConfigWriteMergeStrategy(event.target.value === "replace" ? "replace" : "upsert");
          }}
        >
          <option value="upsert">upsert</option>
          <option value="replace">replace</option>
        </select>
        <label
          className="text-xs text-muted-foreground"
          htmlFor="debug-coverage-config-write-file-path"
        >
          File Path (optional)
        </label>
        <input
          id="debug-coverage-config-write-file-path"
          type="text"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
          value={configWriteFilePath}
          onChange={(event) => {
            setConfigWriteFilePath(event.target.value);
          }}
        />
        <label
          className="text-xs text-muted-foreground"
          htmlFor="debug-coverage-config-write-expected-version"
        >
          Expected Version (optional)
        </label>
        <input
          id="debug-coverage-config-write-expected-version"
          type="text"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
          value={configWriteExpectedVersion}
          onChange={(event) => {
            setConfigWriteExpectedVersion(event.target.value);
          }}
        />
      </div>
      {lastConfigValueWriteResult === null ? (
        <p className="text-xs text-muted-foreground">No config value write captured.</p>
      ) : (
        <div
          className="rounded border border-border/70 p-2 text-xs space-y-1"
          data-testid="debug-coverage-config-value-write-result"
        >
          <p>Key path: {lastConfigValueWriteResult.keyPath}</p>
          <p>Status: {lastConfigValueWriteResult.status}</p>
          <p>Version: {lastConfigValueWriteResult.version}</p>
          <p>File path: {lastConfigValueWriteResult.filePath}</p>
          <p>Merge strategy: {lastConfigValueWriteResult.mergeStrategy}</p>
          <p className="break-all">Value: {lastConfigValueWriteResult.valueSummary}</p>
          {lastConfigValueWriteResult.overriddenMessage !== null && (
            <p>Override: {lastConfigValueWriteResult.overriddenMessage}</p>
          )}
          <p>
            Written: {new Date(lastConfigValueWriteResult.writtenAtIso8601).toLocaleTimeString()}
          </p>
        </div>
      )}
    </div>
  );
}

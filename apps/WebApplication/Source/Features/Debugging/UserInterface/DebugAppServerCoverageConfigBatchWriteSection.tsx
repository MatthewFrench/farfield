import { useState } from "react";
import { Button } from "@/Components/UserInterface/Button";
import { type DebugAppServerCoverageConfigBatchWriteResult } from "../DomainModel/DebugAppServerCoverageContracts";

const DEFAULT_CONFIG_BATCH_EDITS = [
  {
    keyPath: "integrations.github.enabled",
    value: true,
    mergeStrategy: "replace",
  },
  {
    keyPath: "integrations.github.scopes",
    value: ["repo"],
    mergeStrategy: "upsert",
  },
] as const;

export interface DebugAppServerCoverageConfigBatchWriteSectionProps {
  isRunningCoverageAction: boolean;
  lastConfigBatchWriteResult: DebugAppServerCoverageConfigBatchWriteResult | null;
  onWriteConfigBatch: (edits: string, filePath?: string, expectedVersion?: string) => void;
}

/**
 * Owns debug coverage controls for config batch writes.
 * Inputs are serialized JSON edits so operators can exercise array payload and merge-strategy behavior.
 */
export function DebugAppServerCoverageConfigBatchWriteSection({
  isRunningCoverageAction,
  lastConfigBatchWriteResult,
  onWriteConfigBatch,
}: DebugAppServerCoverageConfigBatchWriteSectionProps): React.JSX.Element {
  const [configBatchWriteEdits, setConfigBatchWriteEdits] = useState(
    JSON.stringify(DEFAULT_CONFIG_BATCH_EDITS, null, 2),
  );
  const [configBatchWriteFilePath, setConfigBatchWriteFilePath] = useState("");
  const [configBatchWriteExpectedVersion, setConfigBatchWriteExpectedVersion] = useState("");

  const runCoverageConfigBatchWrite = (): void => {
    onWriteConfigBatch(
      configBatchWriteEdits,
      configBatchWriteFilePath.trim().length > 0 ? configBatchWriteFilePath : undefined,
      configBatchWriteExpectedVersion.trim().length > 0
        ? configBatchWriteExpectedVersion
        : undefined,
    );
  };

  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Config Batch Write
        </h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="debug-coverage-config-batch-write"
          disabled={isRunningCoverageAction}
          onClick={runCoverageConfigBatchWrite}
        >
          Write Batch
        </Button>
      </div>
      <div className="space-y-2">
        <label
          className="text-xs text-muted-foreground"
          htmlFor="debug-coverage-config-batch-write-edits"
        >
          JSON Edits Array
        </label>
        <textarea
          id="debug-coverage-config-batch-write-edits"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs min-h-28"
          value={configBatchWriteEdits}
          onChange={(event) => {
            setConfigBatchWriteEdits(event.target.value);
          }}
        />
        <label
          className="text-xs text-muted-foreground"
          htmlFor="debug-coverage-config-batch-write-file-path"
        >
          File Path (optional)
        </label>
        <input
          id="debug-coverage-config-batch-write-file-path"
          type="text"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
          value={configBatchWriteFilePath}
          onChange={(event) => {
            setConfigBatchWriteFilePath(event.target.value);
          }}
        />
        <label
          className="text-xs text-muted-foreground"
          htmlFor="debug-coverage-config-batch-write-expected-version"
        >
          Expected Version (optional)
        </label>
        <input
          id="debug-coverage-config-batch-write-expected-version"
          type="text"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
          value={configBatchWriteExpectedVersion}
          onChange={(event) => {
            setConfigBatchWriteExpectedVersion(event.target.value);
          }}
        />
      </div>
      {lastConfigBatchWriteResult === null ? (
        <p className="text-xs text-muted-foreground">No config batch write captured.</p>
      ) : (
        <div
          className="rounded border border-border/70 p-2 text-xs space-y-1"
          data-testid="debug-coverage-config-batch-write-result"
        >
          <p>Edit count: {lastConfigBatchWriteResult.editCount}</p>
          <p>Status: {lastConfigBatchWriteResult.status}</p>
          <p>Version: {lastConfigBatchWriteResult.version}</p>
          <p>File path: {lastConfigBatchWriteResult.filePath}</p>
          {lastConfigBatchWriteResult.overriddenMessage !== null && (
            <p>Override: {lastConfigBatchWriteResult.overriddenMessage}</p>
          )}
          <p>
            Written: {new Date(lastConfigBatchWriteResult.writtenAtIso8601).toLocaleTimeString()}
          </p>
        </div>
      )}
    </div>
  );
}

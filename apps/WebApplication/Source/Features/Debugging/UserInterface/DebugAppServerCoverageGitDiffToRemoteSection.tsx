import { useState } from "react";
import { Button } from "@/Components/UserInterface/Button";
import { type DebugAppServerCoverageGitDiffToRemoteResult } from "../DomainModel/DebugAppServerCoverageContracts";

export interface DebugAppServerCoverageGitDiffToRemoteSectionProps {
  isRunningCoverageAction: boolean;
  lastGitDiffToRemoteResult: DebugAppServerCoverageGitDiffToRemoteResult | null;
  onReadGitDiffToRemote: (cwd: string) => void;
}

/**
 * Owns debug coverage controls for git diff to remote reads.
 * This allows operators to quickly validate branch divergence from a chosen working directory.
 */
export function DebugAppServerCoverageGitDiffToRemoteSection({
  isRunningCoverageAction,
  lastGitDiffToRemoteResult,
  onReadGitDiffToRemote,
}: DebugAppServerCoverageGitDiffToRemoteSectionProps): React.JSX.Element {
  const [workingDirectory, setWorkingDirectory] = useState("");

  const runGitDiffRead = (): void => {
    onReadGitDiffToRemote(workingDirectory);
  };

  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Git Diff To Remote
        </h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="debug-coverage-git-diff-read"
          disabled={isRunningCoverageAction}
          onClick={runGitDiffRead}
        >
          Read Diff
        </Button>
      </div>
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground" htmlFor="debug-coverage-git-diff-cwd">
          Working Directory
        </label>
        <input
          id="debug-coverage-git-diff-cwd"
          type="text"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
          value={workingDirectory}
          onChange={(event) => {
            setWorkingDirectory(event.target.value);
          }}
        />
      </div>
      {lastGitDiffToRemoteResult === null ? (
        <p className="text-xs text-muted-foreground">No git diff captured.</p>
      ) : (
        <div
          className="rounded border border-border/70 p-2 text-xs space-y-2"
          data-testid="debug-coverage-git-diff-result"
        >
          <p>Working directory: {lastGitDiffToRemoteResult.cwd}</p>
          <p>Head commit: {lastGitDiffToRemoteResult.sha}</p>
          <p>Read at: {new Date(lastGitDiffToRemoteResult.readAtIso8601).toLocaleTimeString()}</p>
          <div className="space-y-1">
            <p className="text-muted-foreground">Diff</p>
            <pre className="rounded border border-border/60 bg-background p-2 whitespace-pre-wrap break-words">
              {lastGitDiffToRemoteResult.diff.length > 0
                ? lastGitDiffToRemoteResult.diff
                : "(empty)"}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { Button } from "@/Components/UserInterface/Button";
import { type DebugAppServerCoverageCommandExecutionResult } from "../DomainModel/DebugAppServerCoverageContracts";

export interface DebugAppServerCoverageCommandExecutionSectionProps {
  isRunningCoverageAction: boolean;
  lastCommandExecutionResult: DebugAppServerCoverageCommandExecutionResult | null;
  onExecuteCommand: (command: string[], timeoutMs?: number, cwd?: string) => void;
}

/**
 * Owns command-execution controls for debug coverage diagnostics.
 * Form fields map directly to command/exec options so operators can verify server behavior quickly.
 */
export function DebugAppServerCoverageCommandExecutionSection({
  isRunningCoverageAction,
  lastCommandExecutionResult,
  onExecuteCommand,
}: DebugAppServerCoverageCommandExecutionSectionProps): React.JSX.Element {
  const [commandExecutable, setCommandExecutable] = useState("pwd");
  const [commandArgumentsText, setCommandArgumentsText] = useState("");
  const [commandWorkingDirectory, setCommandWorkingDirectory] = useState("");
  const [commandTimeoutMilliseconds, setCommandTimeoutMilliseconds] = useState("2000");

  const runCoverageCommand = (): void => {
    const normalizedExecutable = commandExecutable.trim();
    if (normalizedExecutable.length === 0) {
      return;
    }

    const commandArguments = commandArgumentsText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const command = [normalizedExecutable, ...commandArguments];

    const normalizedTimeout = commandTimeoutMilliseconds.trim();
    const parsedTimeout = normalizedTimeout.length === 0 ? undefined : Number(normalizedTimeout);
    if (parsedTimeout !== undefined && (!Number.isInteger(parsedTimeout) || parsedTimeout < 0)) {
      return;
    }

    const normalizedWorkingDirectory = commandWorkingDirectory.trim();
    onExecuteCommand(
      command,
      parsedTimeout,
      normalizedWorkingDirectory.length > 0 ? normalizedWorkingDirectory : undefined,
    );
  };

  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Command Execution
        </h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="debug-coverage-command-exec-run"
          disabled={isRunningCoverageAction}
          onClick={runCoverageCommand}
        >
          Run Command
        </Button>
      </div>
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground" htmlFor="debug-coverage-command">
          Executable
        </label>
        <input
          id="debug-coverage-command"
          type="text"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
          value={commandExecutable}
          onChange={(event) => {
            setCommandExecutable(event.target.value);
          }}
        />
        <label className="text-xs text-muted-foreground" htmlFor="debug-coverage-command-args">
          Arguments (one per line)
        </label>
        <textarea
          id="debug-coverage-command-args"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs min-h-16"
          value={commandArgumentsText}
          onChange={(event) => {
            setCommandArgumentsText(event.target.value);
          }}
        />
        <label className="text-xs text-muted-foreground" htmlFor="debug-coverage-command-cwd">
          Working Directory (optional)
        </label>
        <input
          id="debug-coverage-command-cwd"
          type="text"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
          value={commandWorkingDirectory}
          onChange={(event) => {
            setCommandWorkingDirectory(event.target.value);
          }}
        />
        <label
          className="text-xs text-muted-foreground"
          htmlFor="debug-coverage-command-timeout-ms"
        >
          Timeout (milliseconds, optional)
        </label>
        <input
          id="debug-coverage-command-timeout-ms"
          type="text"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
          value={commandTimeoutMilliseconds}
          onChange={(event) => {
            setCommandTimeoutMilliseconds(event.target.value);
          }}
        />
      </div>
      {lastCommandExecutionResult === null ? (
        <p className="text-xs text-muted-foreground">No command output captured.</p>
      ) : (
        <div
          className="rounded border border-border/70 p-2 text-xs space-y-2"
          data-testid="debug-coverage-command-exec-result"
        >
          <p>
            Command:{" "}
            <span className="font-mono">{lastCommandExecutionResult.command.join(" ")}</span>
          </p>
          <p>Exit code: {lastCommandExecutionResult.exitCode}</p>
          <p>
            Executed: {new Date(lastCommandExecutionResult.executedAtIso8601).toLocaleTimeString()}
          </p>
          <div className="space-y-1">
            <p className="text-muted-foreground">stdout</p>
            <pre className="rounded border border-border/60 bg-background p-2 whitespace-pre-wrap break-words">
              {lastCommandExecutionResult.stdout.length > 0
                ? lastCommandExecutionResult.stdout
                : "(empty)"}
            </pre>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">stderr</p>
            <pre className="rounded border border-border/60 bg-background p-2 whitespace-pre-wrap break-words">
              {lastCommandExecutionResult.stderr.length > 0
                ? lastCommandExecutionResult.stderr
                : "(empty)"}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

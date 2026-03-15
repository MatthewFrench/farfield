import { useState } from "react";
import { Button } from "@/Components/UserInterface/Button";
import type {
  DebugAppServerCoverageThreadRealtimeAppendAudioResult,
  DebugAppServerCoverageThreadRealtimeAppendTextResult,
  DebugAppServerCoverageThreadRealtimeAudioChunk,
  DebugAppServerCoverageThreadRealtimeStartResult,
  DebugAppServerCoverageThreadRealtimeStopResult,
  DebugAppServerCoverageWindowsSandboxSetupMode,
  DebugAppServerCoverageWindowsSandboxSetupStartResult,
} from "../DomainModel/DebugAppServerCoverageContracts";

export interface DebugAppServerCoverageRealtimeAndWindowsSectionProps {
  isRunningCoverageAction: boolean;
  lastThreadRealtimeStartResult: DebugAppServerCoverageThreadRealtimeStartResult | null;
  lastThreadRealtimeAppendAudioResult: DebugAppServerCoverageThreadRealtimeAppendAudioResult | null;
  lastThreadRealtimeAppendTextResult: DebugAppServerCoverageThreadRealtimeAppendTextResult | null;
  lastThreadRealtimeStopResult: DebugAppServerCoverageThreadRealtimeStopResult | null;
  lastWindowsSandboxSetupStartResult: DebugAppServerCoverageWindowsSandboxSetupStartResult | null;
  onStartThreadRealtime: (threadId: string, prompt: string, sessionId?: string) => void;
  onAppendThreadRealtimeAudio: (
    threadId: string,
    audio: DebugAppServerCoverageThreadRealtimeAudioChunk,
  ) => void;
  onAppendThreadRealtimeText: (threadId: string, text: string) => void;
  onStopThreadRealtime: (threadId: string) => void;
  onStartWindowsSandboxSetup: (mode: DebugAppServerCoverageWindowsSandboxSetupMode) => void;
}

/**
 * Owns realtime and windows-sandbox diagnostics controls in coverage panel.
 * These controls intentionally mirror route inputs so operators can verify end-to-end behavior.
 */
export function DebugAppServerCoverageRealtimeAndWindowsSection({
  isRunningCoverageAction,
  lastThreadRealtimeStartResult,
  lastThreadRealtimeAppendAudioResult,
  lastThreadRealtimeAppendTextResult,
  lastThreadRealtimeStopResult,
  lastWindowsSandboxSetupStartResult,
  onStartThreadRealtime,
  onAppendThreadRealtimeAudio,
  onAppendThreadRealtimeText,
  onStopThreadRealtime,
  onStartWindowsSandboxSetup,
}: DebugAppServerCoverageRealtimeAndWindowsSectionProps): React.JSX.Element {
  const [threadRealtimeThreadId, setThreadRealtimeThreadId] = useState("");
  const [threadRealtimePrompt, setThreadRealtimePrompt] = useState(
    "Summarize this repository and suggest the next implementation step.",
  );
  const [threadRealtimeSessionId, setThreadRealtimeSessionId] = useState("");
  const [threadRealtimeText, setThreadRealtimeText] = useState(
    "Continue with concrete implementation details.",
  );
  const [threadRealtimeAudioData, setThreadRealtimeAudioData] = useState("base64-audio-chunk");
  const [threadRealtimeAudioSampleRate, setThreadRealtimeAudioSampleRate] = useState("16000");
  const [threadRealtimeAudioNumChannels, setThreadRealtimeAudioNumChannels] = useState("1");
  const [threadRealtimeAudioSamplesPerChannel, setThreadRealtimeAudioSamplesPerChannel] =
    useState("640");
  const [windowsSandboxMode, setWindowsSandboxMode] =
    useState<DebugAppServerCoverageWindowsSandboxSetupMode>("unelevated");

  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Realtime and Windows Sandbox
      </h4>

      <div className="space-y-2">
        <label
          className="text-xs text-muted-foreground"
          htmlFor="debug-coverage-realtime-thread-id"
        >
          Thread Id
        </label>
        <input
          id="debug-coverage-realtime-thread-id"
          type="text"
          value={threadRealtimeThreadId}
          onChange={(event) => {
            setThreadRealtimeThreadId(event.target.value);
          }}
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
          data-testid="debug-coverage-realtime-thread-id-input"
        />

        <label className="text-xs text-muted-foreground" htmlFor="debug-coverage-realtime-prompt">
          Start Prompt
        </label>
        <textarea
          id="debug-coverage-realtime-prompt"
          value={threadRealtimePrompt}
          onChange={(event) => {
            setThreadRealtimePrompt(event.target.value);
          }}
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs min-h-16"
          data-testid="debug-coverage-realtime-prompt-input"
        />

        <label
          className="text-xs text-muted-foreground"
          htmlFor="debug-coverage-realtime-session-id"
        >
          Session Id (optional)
        </label>
        <input
          id="debug-coverage-realtime-session-id"
          type="text"
          value={threadRealtimeSessionId}
          onChange={(event) => {
            setThreadRealtimeSessionId(event.target.value);
          }}
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
          data-testid="debug-coverage-realtime-session-id-input"
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="debug-coverage-thread-realtime-start-run"
            disabled={isRunningCoverageAction}
            onClick={() => {
              const normalizedSessionId = threadRealtimeSessionId.trim();
              onStartThreadRealtime(
                threadRealtimeThreadId,
                threadRealtimePrompt,
                normalizedSessionId.length > 0 ? normalizedSessionId : undefined,
              );
            }}
          >
            Start Realtime
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="debug-coverage-thread-realtime-stop-run"
            disabled={isRunningCoverageAction}
            onClick={() => {
              onStopThreadRealtime(threadRealtimeThreadId);
            }}
          >
            Stop Realtime
          </Button>
        </div>

        <label className="text-xs text-muted-foreground" htmlFor="debug-coverage-realtime-text">
          Append Text
        </label>
        <textarea
          id="debug-coverage-realtime-text"
          value={threadRealtimeText}
          onChange={(event) => {
            setThreadRealtimeText(event.target.value);
          }}
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs min-h-12"
          data-testid="debug-coverage-realtime-text-input"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="debug-coverage-thread-realtime-append-text-run"
          disabled={isRunningCoverageAction}
          onClick={() => {
            onAppendThreadRealtimeText(threadRealtimeThreadId, threadRealtimeText);
          }}
        >
          Append Text
        </Button>

        <label
          className="text-xs text-muted-foreground"
          htmlFor="debug-coverage-realtime-audio-data"
        >
          Append Audio (base64)
        </label>
        <textarea
          id="debug-coverage-realtime-audio-data"
          value={threadRealtimeAudioData}
          onChange={(event) => {
            setThreadRealtimeAudioData(event.target.value);
          }}
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs min-h-12"
          data-testid="debug-coverage-realtime-audio-data-input"
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            type="number"
            value={threadRealtimeAudioSampleRate}
            onChange={(event) => {
              setThreadRealtimeAudioSampleRate(event.target.value);
            }}
            className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
            data-testid="debug-coverage-realtime-audio-sample-rate-input"
            placeholder="Sample Rate"
          />
          <input
            type="number"
            value={threadRealtimeAudioNumChannels}
            onChange={(event) => {
              setThreadRealtimeAudioNumChannels(event.target.value);
            }}
            className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
            data-testid="debug-coverage-realtime-audio-num-channels-input"
            placeholder="Channels"
          />
          <input
            type="number"
            value={threadRealtimeAudioSamplesPerChannel}
            onChange={(event) => {
              setThreadRealtimeAudioSamplesPerChannel(event.target.value);
            }}
            className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
            data-testid="debug-coverage-realtime-audio-samples-per-channel-input"
            placeholder="Samples/Channel"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="debug-coverage-thread-realtime-append-audio-run"
          disabled={isRunningCoverageAction}
          onClick={() => {
            const normalizedSamplesPerChannel = threadRealtimeAudioSamplesPerChannel.trim();
            onAppendThreadRealtimeAudio(threadRealtimeThreadId, {
              data: threadRealtimeAudioData,
              sampleRate: Number(threadRealtimeAudioSampleRate),
              numChannels: Number(threadRealtimeAudioNumChannels),
              samplesPerChannel:
                normalizedSamplesPerChannel.length > 0 ? Number(normalizedSamplesPerChannel) : null,
            });
          }}
        >
          Append Audio
        </Button>
      </div>

      <div className="space-y-1 text-xs">
        {lastThreadRealtimeStartResult !== null && (
          <p data-testid="debug-coverage-thread-realtime-start-result">
            Realtime started for {lastThreadRealtimeStartResult.threadId} at{" "}
            {new Date(lastThreadRealtimeStartResult.startedAtIso8601).toLocaleTimeString()}
          </p>
        )}
        {lastThreadRealtimeAppendAudioResult !== null && (
          <p data-testid="debug-coverage-thread-realtime-append-audio-result">
            Realtime audio appended for {lastThreadRealtimeAppendAudioResult.threadId} at{" "}
            {new Date(lastThreadRealtimeAppendAudioResult.appendedAtIso8601).toLocaleTimeString()}
          </p>
        )}
        {lastThreadRealtimeAppendTextResult !== null && (
          <p data-testid="debug-coverage-thread-realtime-append-text-result">
            Realtime text appended for {lastThreadRealtimeAppendTextResult.threadId} at{" "}
            {new Date(lastThreadRealtimeAppendTextResult.appendedAtIso8601).toLocaleTimeString()}
          </p>
        )}
        {lastThreadRealtimeStopResult !== null && (
          <p data-testid="debug-coverage-thread-realtime-stop-result">
            Realtime stopped for {lastThreadRealtimeStopResult.threadId} at{" "}
            {new Date(lastThreadRealtimeStopResult.stoppedAtIso8601).toLocaleTimeString()}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Windows Sandbox Setup
        </h5>
        <label className="text-xs text-muted-foreground" htmlFor="debug-coverage-windows-mode">
          Setup Mode
        </label>
        <select
          id="debug-coverage-windows-mode"
          value={windowsSandboxMode}
          onChange={(event) => {
            const nextModeValue = event.target.value;
            if (nextModeValue === "elevated" || nextModeValue === "unelevated") {
              setWindowsSandboxMode(nextModeValue);
            }
          }}
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
          data-testid="debug-coverage-windows-sandbox-mode-select"
        >
          <option value="unelevated">Unelevated</option>
          <option value="elevated">Elevated</option>
        </select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="debug-coverage-windows-sandbox-setup-start-run"
          disabled={isRunningCoverageAction}
          onClick={() => {
            onStartWindowsSandboxSetup(windowsSandboxMode);
          }}
        >
          Start Setup
        </Button>
        {lastWindowsSandboxSetupStartResult !== null && (
          <p className="text-xs" data-testid="debug-coverage-windows-sandbox-setup-result">
            Mode {lastWindowsSandboxSetupStartResult.mode}:{" "}
            {lastWindowsSandboxSetupStartResult.started ? "Started" : "Not started"} at{" "}
            {new Date(lastWindowsSandboxSetupStartResult.startedAtIso8601).toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  );
}

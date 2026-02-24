import { Button } from "@/Components/UserInterface/Button";
import { Input } from "@/Components/UserInterface/Input";

export interface DebugTraceSummary {
  id: string;
  label: string;
  eventCount: number;
  path: string;
}

interface DebugTracePanelProps {
  isRecording: boolean;
  traceLabel: string;
  traceNote: string;
  onTraceLabelChange: (value: string) => void;
  onTraceNoteChange: (value: string) => void;
  onStartTrace: () => void;
  onMarkTrace: () => void;
  onStopTrace: () => void;
  recentTraces: readonly DebugTraceSummary[];
}

export function DebugTracePanel({
  isRecording,
  traceLabel,
  traceNote,
  onTraceLabelChange,
  onTraceNoteChange,
  onStartTrace,
  onMarkTrace,
  onStopTrace,
  recentTraces
}: DebugTracePanelProps): React.JSX.Element {
  return (
    <div data-testid="debug-trace-panel" className="flex-1 overflow-y-auto p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Trace</span>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
            isRecording
              ? "bg-success/15 text-success"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {isRecording ? "recording" : "idle"}
        </span>
      </div>
      <Input
        value={traceLabel}
        onChange={(event) => onTraceLabelChange(event.target.value)}
        placeholder="label"
        className="h-8 text-base md:text-xs"
      />
      <Input
        value={traceNote}
        onChange={(event) => onTraceNoteChange(event.target.value)}
        placeholder="marker note"
        className="h-8 text-base md:text-xs"
      />
      <div className="flex gap-1.5">
        <Button
          type="button"
          onClick={onStartTrace}
          variant="outline"
          size="sm"
          className="h-8 text-xs"
        >
          Start
        </Button>
        <Button
          type="button"
          onClick={onMarkTrace}
          variant="outline"
          size="sm"
          className="h-8 text-xs"
        >
          Mark
        </Button>
        <Button
          type="button"
          onClick={onStopTrace}
          variant="outline"
          size="sm"
          className="h-8 text-xs"
        >
          Stop
        </Button>
      </div>
      <div className="pt-2 border-t border-border">
        <div className="text-xs font-medium text-muted-foreground mb-1.5">Recent traces</div>
        <div className="space-y-1.5">
          {recentTraces.map((trace) => (
            <div key={trace.id} className="rounded-md border border-border px-2.5 py-2 text-[11px]">
              <div className="font-mono truncate">{trace.label}</div>
              <div className="text-muted-foreground">events {trace.eventCount}</div>
              <div className="text-muted-foreground/80 font-mono truncate">{trace.path}</div>
            </div>
          ))}
          {recentTraces.length === 0 && (
            <div className="text-xs text-muted-foreground">No traces yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

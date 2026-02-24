import { Activity } from "lucide-react";

interface DebugStreamEventsPanelProps {
  streamEventCount: number;
  streamEventCards: readonly React.JSX.Element[];
}

export function DebugStreamEventsPanel({
  streamEventCount,
  streamEventCards
}: DebugStreamEventsPanelProps): React.JSX.Element {
  return (
    <div data-testid="debug-stream-events-panel" className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0">
        <Activity size={13} className="text-muted-foreground" />
        <span className="text-xs font-medium">Stream Events</span>
        <span className="text-xs text-muted-foreground/60">{streamEventCount}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">{streamEventCards}</div>
    </div>
  );
}

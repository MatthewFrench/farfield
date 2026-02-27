import { Button } from "@/Components/UserInterface/Button";
import {
  DebugHistoryDetailPanel,
  type ReplayHistoryEntryRequestInput,
} from "./DebugHistoryDetailPanel";

export interface DebugHistoryEntryListItem {
  id: string;
  at: string;
  source: "ipc" | "app" | "system";
  direction: "in" | "out" | "system";
}

type DebugHistoryDirection = DebugHistoryEntryListItem["direction"];
const HISTORY_ENTRY_DIRECTION_BADGE_CLASS_NAME_BY_DIRECTION: Record<DebugHistoryDirection, string> =
  {
    in: "bg-success/15 text-success",
    out: "bg-blue-500/15 text-blue-400",
    system: "bg-muted text-muted-foreground",
  };

interface DebugHistoryPanelProps {
  historyEntries: readonly DebugHistoryEntryListItem[];
  selectedHistoryEntryId: string;
  selectedHistoryDetailEntryId: string | null;
  selectedHistoryDetailPayloadText: string;
  waitForReplayResponse: boolean;
  onHistoryEntrySelect: (historyEntryId: string) => void;
  onWaitForReplayResponseChange: (enabled: boolean) => void;
  onReplayHistoryEntry: (input: ReplayHistoryEntryRequestInput) => void;
}

export function DebugHistoryPanel({
  historyEntries,
  selectedHistoryEntryId,
  selectedHistoryDetailEntryId,
  selectedHistoryDetailPayloadText,
  waitForReplayResponse,
  onHistoryEntrySelect,
  onWaitForReplayResponseChange,
  onReplayHistoryEntry,
}: DebugHistoryPanelProps): React.JSX.Element {
  return (
    <div
      data-testid="debug-history-panel"
      className="flex-1 grid grid-cols-[200px_minmax(0,1fr)] min-h-0 divide-x divide-border overflow-hidden"
    >
      <div className="overflow-y-auto py-1">
        {historyEntries
          .slice()
          .reverse()
          .map((entry) => (
            <Button
              key={entry.id}
              type="button"
              onClick={() => onHistoryEntrySelect(entry.id)}
              variant="ghost"
              className={`w-full h-auto flex-col items-start justify-start gap-0 rounded-none px-3 py-2 text-left transition-colors ${
                selectedHistoryEntryId === entry.id
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase leading-4 ${
                    HISTORY_ENTRY_DIRECTION_BADGE_CLASS_NAME_BY_DIRECTION[entry.direction]
                  }`}
                >
                  {entry.source} {entry.direction}
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground/50 font-mono truncate">
                {entry.at}
              </div>
            </Button>
          ))}
      </div>

      <DebugHistoryDetailPanel
        historyEntryId={selectedHistoryDetailEntryId}
        historyDetailPayloadText={selectedHistoryDetailPayloadText}
        waitForReplayResponse={waitForReplayResponse}
        onWaitForReplayResponseChange={onWaitForReplayResponseChange}
        onReplayHistoryEntry={onReplayHistoryEntry}
      />
    </div>
  );
}

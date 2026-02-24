import { Button } from "@/Components/UserInterface/Button";
import { Checkbox } from "@/Components/UserInterface/Checkbox";
import { Label } from "@/Components/UserInterface/Label";

export interface ReplayHistoryEntryRequestInput {
  entryId: string;
  waitForResponse: boolean;
}

interface DebugHistoryDetailPanelProps {
  historyEntryId: string | null;
  historyDetailPayloadText: string;
  waitForReplayResponse: boolean;
  onWaitForReplayResponseChange: (enabled: boolean) => void;
  onReplayHistoryEntry: (input: ReplayHistoryEntryRequestInput) => void;
}

export function DebugHistoryDetailPanel({
  historyEntryId,
  historyDetailPayloadText,
  waitForReplayResponse,
  onWaitForReplayResponseChange,
  onReplayHistoryEntry
}: DebugHistoryDetailPanelProps): React.JSX.Element {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="overflow-y-auto p-3 space-y-3">
        {historyEntryId === null ? (
          <div className="text-xs text-muted-foreground py-4">Select an entry</div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Label
                htmlFor="wait-for-replay-response"
                className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground cursor-pointer"
              >
                <Checkbox
                  id="wait-for-replay-response"
                  checked={waitForReplayResponse}
                  onCheckedChange={(checked) => onWaitForReplayResponseChange(checked === true)}
                />
                wait for response
              </Label>
              <Button
                type="button"
                onClick={() => {
                  onReplayHistoryEntry({
                    entryId: historyEntryId,
                    waitForResponse: waitForReplayResponse
                  });
                }}
                variant="outline"
                size="sm"
                className="h-7 text-xs"
              >
                Replay
              </Button>
            </div>
            <pre className="font-mono text-[11px] text-muted-foreground leading-5 whitespace-pre-wrap break-words">
              {historyDetailPayloadText}
            </pre>
          </>
        )}
      </div>
    </div>
  );
}

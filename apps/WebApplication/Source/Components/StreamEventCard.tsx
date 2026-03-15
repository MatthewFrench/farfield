import { FileChangeEntrySchema, type IpcFrame, IpcFrameType } from "@farfield/protocol";
import { ChevronRight } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { z } from "zod";
import { DiffBlock } from "@/Components/DiffBlock";
import { Button } from "@/Components/UserInterface/Button";

const EVENT_BODY_JSON_INDENT_SPACES = 2;

const StreamEventDiffParametersSchema = z
  .object({
    changes: z.array(FileChangeEntrySchema),
  })
  .strict();

type StreamEventChange = z.infer<typeof FileChangeEntrySchema>;

export interface StreamEventCardProps {
  event: IpcFrame;
}

function readEventLabel(event: IpcFrame): string {
  if (event.type === IpcFrameType.request || event.type === IpcFrameType.broadcast) {
    return event.method;
  }
  if (
    event.type === IpcFrameType.response &&
    event.method !== undefined &&
    event.method.length > 0
  ) {
    return event.method;
  }
  return event.type;
}

function readDiffChanges(event: IpcFrame): StreamEventChange[] | null {
  if (event.type !== IpcFrameType.request && event.type !== IpcFrameType.broadcast) {
    return null;
  }
  const parsed = StreamEventDiffParametersSchema.safeParse(event.params);
  return parsed.success ? parsed.data.changes : null;
}

function readEventBodyText(event: IpcFrame): string {
  return JSON.stringify(event, null, EVENT_BODY_JSON_INDENT_SPACES);
}

function isDiffPayloadEvent(event: IpcFrame): boolean {
  return event.type === IpcFrameType.request || event.type === IpcFrameType.broadcast;
}

export const StreamEventCard = memo(function StreamEventCard({
  event,
}: StreamEventCardProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const label = useMemo(() => readEventLabel(event), [event]);
  const changes = useMemo(() => {
    if (!open || !isDiffPayloadEvent(event)) {
      return null;
    }
    return readDiffChanges(event);
  }, [event, open]);
  const isFileChange = changes !== null;

  return (
    <div
      data-testid="stream-event-card"
      className="rounded-lg border border-border overflow-hidden"
    >
      <Button
        type="button"
        onClick={() => setOpen((v) => !v)}
        variant="ghost"
        className="h-auto w-full justify-start rounded-none bg-muted/30 px-2.5 py-1.5 text-left hover:bg-muted/60"
      >
        <ChevronRight
          size={10}
          className={`shrink-0 text-muted-foreground/60 transition-transform ${open ? "rotate-90" : ""}`}
        />
        <span className="font-mono text-[11px] text-muted-foreground truncate">{label}</span>
      </Button>
      {open && (
        <div className="border-t border-border px-2.5 py-2">
          {isFileChange ? (
            <DiffBlock changes={changes} />
          ) : (
            <pre className="font-mono text-[11px] text-muted-foreground/80 whitespace-pre-wrap break-words">
              {readEventBodyText(event)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
});

StreamEventCard.displayName = "StreamEventCard";

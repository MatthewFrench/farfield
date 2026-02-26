import { useState } from "react";
import { FileChangeEntrySchema, type IpcFrame } from "@farfield/protocol";
import { ChevronRight } from "lucide-react";
import { z } from "zod";
import { DiffBlock } from "@/Components/DiffBlock";
import { Button } from "@/Components/UserInterface/Button";

const REQUEST_EVENT_TYPE = "request";
const BROADCAST_EVENT_TYPE = "broadcast";
const RESPONSE_EVENT_TYPE = "response";
const EVENT_BODY_JSON_INDENT_SPACES = 2;

const StreamEventDiffParametersSchema = z
  .object({
    changes: z.array(FileChangeEntrySchema)
  })
  .strict();

type StreamEventChange = z.infer<typeof FileChangeEntrySchema>;

export interface StreamEventCardProps {
  event: IpcFrame;
}

function readEventLabel(event: IpcFrame): string {
  if (event.type === REQUEST_EVENT_TYPE || event.type === BROADCAST_EVENT_TYPE) {
    return event.method;
  }
  if (event.type === RESPONSE_EVENT_TYPE && event.method) {
    return event.method;
  }
  return event.type;
}

function readDiffChanges(event: IpcFrame): StreamEventChange[] | null {
  if (event.type !== REQUEST_EVENT_TYPE && event.type !== BROADCAST_EVENT_TYPE) {
    return null;
  }
  const parsed = StreamEventDiffParametersSchema.safeParse(event.params);
  return parsed.success ? parsed.data.changes : null;
}

function readEventBodyText(event: IpcFrame): string {
  return JSON.stringify(event, null, EVENT_BODY_JSON_INDENT_SPACES);
}

export function StreamEventCard({ event }: StreamEventCardProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const label = readEventLabel(event);
  const changes = readDiffChanges(event);
  const isFileChange = changes !== null;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
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
          {isFileChange && changes ? (
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
}

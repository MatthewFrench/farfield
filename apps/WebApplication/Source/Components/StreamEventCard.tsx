import { useState } from "react";
import { type IpcFrame } from "@farfield/protocol";
import { ChevronRight } from "lucide-react";
import { z } from "zod";
import { DiffBlock } from "@/Components/DiffBlock";
import { Button } from "@/Components/UserInterface/Button";

const StreamEventChangeSchema = z
  .object({
    path: z.string().trim().min(1),
    kind: z
      .object({
        type: z.string().trim().min(1),
        move_path: z.string().nullable().optional()
      })
      .strict(),
    diff: z.string().optional()
  })
  .strict();

const StreamEventDiffParametersSchema = z
  .object({
    changes: z.array(StreamEventChangeSchema)
  })
  .strict();

type StreamEventChange = z.infer<typeof StreamEventChangeSchema>;

function readEventLabel(event: IpcFrame): string {
  if (event.type === "request" || event.type === "broadcast") {
    return event.method;
  }
  if (event.type === "response" && event.method) {
    return event.method;
  }
  return event.type;
}

function readDiffChanges(event: IpcFrame): StreamEventChange[] | null {
  if (event.type !== "request" && event.type !== "broadcast") {
    return null;
  }
  const parsed = StreamEventDiffParametersSchema.safeParse(event.params);
  return parsed.success ? parsed.data.changes : null;
}

export function StreamEventCard({ event }: { event: IpcFrame }): React.JSX.Element {
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
              {JSON.stringify(event, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

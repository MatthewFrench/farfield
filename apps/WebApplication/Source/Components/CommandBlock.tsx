import type { CommandExecutionItemSchema } from "@farfield/protocol";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  ChevronRight,
  FileSearch,
  FileText,
  FolderOpen,
  Loader2,
  Search,
  Terminal,
  XCircle,
} from "lucide-react";
import { memo, useState } from "react";
import type { z } from "zod";
import { Button } from "@/Components/UserInterface/Button";
import { CodeSnippet } from "./CodeSnippet";

type CommandItem = z.infer<typeof CommandExecutionItemSchema>;

const COMMAND_PREVIEW_MAXIMUM_LENGTH = 140;
const COMMAND_EMPTY_OUTPUT_LABEL = "No output";

const ACTION_ICONS: Record<string, React.ElementType> = {
  search: Search,
  listFiles: FolderOpen,
  write: FileText,
  read: FileSearch,
  readFile: FileSearch,
  writeFile: FileText,
};

function simplifyCommand(cmd: string): string {
  return cmd.length > COMMAND_PREVIEW_MAXIMUM_LENGTH
    ? cmd.slice(0, COMMAND_PREVIEW_MAXIMUM_LENGTH) + "…"
    : cmd;
}

interface CommandBlockProps {
  item: CommandItem;
  isActive: boolean;
}

function CommandBlockComponent({ item, isActive }: CommandBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const isCompleted = item.status === "completed";
  const isSuccess = item.exitCode === 0 || item.exitCode == null;
  const output = item.aggregatedOutput ?? "";
  const hasOutput = output.trim().length > 0;
  const commandActions = item.commandActions ?? [];
  const hasActions = commandActions.length > 0;

  return (
    <div className="rounded-xl border border-border overflow-hidden text-sm">
      {/* Header row */}
      <Button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        variant="ghost"
        className="h-auto w-full justify-start rounded-none bg-muted/40 px-3 py-2 text-left transition-colors hover:bg-muted/70"
      >
        <Terminal size={12} className="shrink-0 text-muted-foreground" />
        <code className="flex-1 font-mono text-xs text-foreground/80 truncate min-w-0">
          {simplifyCommand(item.command)}
        </code>
        <div className="flex items-center gap-1.5 shrink-0">
          {isActive ? (
            <Loader2 size={12} className="animate-spin text-muted-foreground" />
          ) : isCompleted ? (
            isSuccess ? (
              <CheckCircle2 size={12} className="text-success" />
            ) : (
              <XCircle size={12} className="text-danger" />
            )
          ) : null}
          {item.durationMs != null && (
            <span className="text-[11px] text-muted-foreground/50 font-mono">
              {item.durationMs}ms
            </span>
          )}
          <ChevronRight
            size={12}
            className={`text-muted-foreground/60 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
          />
        </div>
      </Button>

      {/* Expanded body */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-border divide-y divide-border/60">
              {/* Command actions */}
              {hasActions && (
                <div className="px-3 py-2 space-y-1.5">
                  {commandActions.map((action, i) => {
                    const Icon = ACTION_ICONS[action.type] ?? Terminal;
                    const label = action.name ?? action.command ?? action.path ?? action.type;
                    return (
                      <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Icon size={10} className="mt-0.5 shrink-0 opacity-60" />
                        <code className="font-mono break-all leading-4">{label}</code>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Output */}
              {hasOutput && (
                <div className="px-3 py-2 space-y-2">
                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Command
                    </div>
                    <CodeSnippet code={item.command} language="bash" />
                  </div>
                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Output
                    </div>
                    <CodeSnippet
                      code={output}
                      language="bash"
                      className="max-h-56 overflow-y-auto"
                    />
                  </div>
                </div>
              )}

              {!hasActions && !hasOutput && (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  {COMMAND_EMPTY_OUTPUT_LABEL}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function areCommandBlockPropsEqual(prev: CommandBlockProps, next: CommandBlockProps): boolean {
  return prev.item === next.item && prev.isActive === next.isActive;
}

export const CommandBlock = memo(CommandBlockComponent, areCommandBlockPropsEqual);

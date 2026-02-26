import { memo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, FilePlus, FileMinus, FileEdit, type LucideIcon } from "lucide-react";
import type { z } from "zod";
import type { FileChangeEntrySchema } from "@farfield/protocol";
import { Button } from "@/Components/UserInterface/Button";

type FileChange = z.infer<typeof FileChangeEntrySchema>;

interface PathDisplayParts {
  fileName: string;
  directoryPath: string | null;
}

interface DiffSummary {
  addedLineCount: number;
  removedLineCount: number;
}

interface FileChangeKindMetadata {
  Icon: LucideIcon;
  label: string;
  className: string;
}

interface DiffBlockProps {
  changes: readonly FileChange[];
}

type LineType = "add" | "remove" | "header" | "context";
interface DiffLine { type: LineType; content: string }

const PATH_SEPARATOR = "/";
const DIFF_HEADER_PREFIXES = ["@@", "+++", "---"] as const;
const DIFF_ADDED_LINE_PREFIX = "+";
const DIFF_REMOVED_LINE_PREFIX = "-";
const DIFF_CONTEXT_LINE_PREFIX = " ";
const FILE_CHANGE_TYPE_CREATE = "create";
const FILE_CHANGE_TYPE_DELETE = "delete";
const FILE_CHANGE_CREATED_LABEL = "created";
const FILE_CHANGE_DELETED_LABEL = "deleted";
const FILE_CHANGE_MODIFIED_LABEL = "modified";
const FILE_CHANGE_CREATED_CLASS_NAME = "text-success";
const FILE_CHANGE_DELETED_CLASS_NAME = "text-danger";
const FILE_CHANGE_MODIFIED_CLASS_NAME = "text-blue-400 dark:text-blue-400";
const COLLAPSE_TRANSITION_DURATION_SECONDS = 0.24;
const COLLAPSE_TRANSITION_EASE = "easeInOut";
const NO_DIFF_AVAILABLE_LABEL = "No diff available";

function readPathDisplayParts(path: string): PathDisplayParts {
  const separatorIndex = path.lastIndexOf(PATH_SEPARATOR);

  // Some tool events emit only a file name without directory segments.
  if (separatorIndex <= 0) {
    return { fileName: path, directoryPath: null };
  }

  return {
    fileName: path.slice(separatorIndex + 1),
    directoryPath: path.slice(0, separatorIndex)
  };
}

function isHeaderLine(line: string): boolean {
  return DIFF_HEADER_PREFIXES.some((prefix) => line.startsWith(prefix));
}

function readDiffLine(line: string): DiffLine | null {
  if (isHeaderLine(line)) {
    return { type: "header", content: line };
  }

  if (line.startsWith(DIFF_ADDED_LINE_PREFIX)) {
    return { type: "add", content: line.slice(1) };
  }

  if (line.startsWith(DIFF_REMOVED_LINE_PREFIX)) {
    return { type: "remove", content: line.slice(1) };
  }

  const content = line.startsWith(DIFF_CONTEXT_LINE_PREFIX) ? line.slice(1) : line;
  if (content.length === 0) {
    return null;
  }

  return { type: "context", content };
}

function parseDiff(raw: string): DiffLine[] {
  const result: DiffLine[] = [];
  for (const line of raw.split("\n")) {
    const parsedLine = readDiffLine(line);
    if (parsedLine !== null) {
      result.push(parsedLine);
    }
  }
  return result;
}

function readDiffSummary(lines: readonly DiffLine[]): DiffSummary {
  let addedLineCount = 0;
  let removedLineCount = 0;

  for (const line of lines) {
    if (line.type === "add") {
      addedLineCount += 1;
      continue;
    }

    if (line.type === "remove") {
      removedLineCount += 1;
    }
  }

  return { addedLineCount, removedLineCount };
}

function readFileChangeKindMetadata(kind: string): FileChangeKindMetadata {
  if (kind === FILE_CHANGE_TYPE_CREATE) {
    return {
      Icon: FilePlus,
      label: FILE_CHANGE_CREATED_LABEL,
      className: FILE_CHANGE_CREATED_CLASS_NAME
    };
  }

  if (kind === FILE_CHANGE_TYPE_DELETE) {
    return {
      Icon: FileMinus,
      label: FILE_CHANGE_DELETED_LABEL,
      className: FILE_CHANGE_DELETED_CLASS_NAME
    };
  }

  return {
    Icon: FileEdit,
    label: FILE_CHANGE_MODIFIED_LABEL,
    className: FILE_CHANGE_MODIFIED_CLASS_NAME
  };
}

const LINE_STYLES: Record<LineType, string> = {
  add: "bg-success/8 dark:bg-success/10",
  remove: "bg-danger/8 dark:bg-danger/10",
  header: "bg-muted/60",
  context: ""
};
const TEXT_STYLES: Record<LineType, string> = {
  add: "text-success dark:text-success/90",
  remove: "text-danger dark:text-danger/90",
  header: "text-muted-foreground/60 italic",
  context: "text-foreground/70"
};
const GUTTER_STYLES: Record<LineType, string> = {
  add: "text-success/50",
  remove: "text-danger/50",
  header: "text-muted-foreground/30",
  context: "text-muted-foreground/25"
};
const GUTTER_CHAR: Record<LineType, string> = { add: "+", remove: "−", header: "", context: " " };

function DiffBlockComponent({ changes }: DiffBlockProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  return (
    <div className="rounded-xl border border-border overflow-hidden text-sm">
      {changes.map((change, i) => {
        const isExpanded = expandedIdx === i;
        const { fileName, directoryPath } = readPathDisplayParts(change.path);
        const lines = change.diff !== undefined && change.diff.length > 0 ? parseDiff(change.diff) : [];
        const { addedLineCount, removedLineCount } = readDiffSummary(lines);
        const kindMetadata = readFileChangeKindMetadata(change.kind.type);
        const { Icon, label, className } = kindMetadata;

        return (
          <div key={`${change.path}-${String(i)}`} className={i > 0 ? "border-t border-border" : ""}>
            <Button
              type="button"
              onClick={() => setExpandedIdx(isExpanded ? null : i)}
              variant="ghost"
              className="h-auto w-full justify-start rounded-none bg-muted/40 px-3 py-2.5 text-left transition-colors hover:bg-muted/70"
            >
              <Icon size={12} className={`shrink-0 ${className}`} />
              <span className="font-mono text-xs font-medium text-foreground truncate">{fileName}</span>
              {directoryPath !== null && directoryPath.length > 0 && (
                <span className="text-[11px] text-muted-foreground/40 truncate hidden sm:block">
                  {directoryPath}
                </span>
              )}
              <div className="flex items-center gap-2 ml-auto shrink-0">
                {addedLineCount > 0 && (
                  <span className="text-xs font-mono text-success">+{addedLineCount}</span>
                )}
                {removedLineCount > 0 && (
                  <span className="text-xs font-mono text-danger">−{removedLineCount}</span>
                )}
                <span className={`text-[10px] font-medium ${className}`}>{label}</span>
                <ChevronRight
                  size={11}
                  className={`text-muted-foreground/50 transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`}
                />
              </div>
            </Button>

            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  key={`diff-${i}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: COLLAPSE_TRANSITION_DURATION_SECONDS, ease: COLLAPSE_TRANSITION_EASE }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-border overflow-x-auto">
                    {change.diff !== undefined && change.diff.length > 0 ? (
                      lines.map((line, j) => (
                        <div
                          key={j}
                          className={`flex font-mono text-xs leading-5 ${LINE_STYLES[line.type]}`}
                        >
                          <span
                            className={`select-none w-6 text-center text-[10px] shrink-0 pt-px ${GUTTER_STYLES[line.type]}`}
                          >
                            {GUTTER_CHAR[line.type]}
                          </span>
                          <span
                            className={`flex-1 px-2 py-0.5 whitespace-pre-wrap break-all ${TEXT_STYLES[line.type]}`}
                          >
                            {line.content}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-xs text-muted-foreground">{NO_DIFF_AVAILABLE_LABEL}</div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

function areDiffBlockPropsEqual(prev: DiffBlockProps, next: DiffBlockProps): boolean {
  return prev.changes === next.changes;
}

export const DiffBlock = memo(DiffBlockComponent, areDiffBlockPropsEqual);

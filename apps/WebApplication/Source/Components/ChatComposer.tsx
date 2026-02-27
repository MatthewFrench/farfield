import { ArrowUp, Loader2, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/Components/UserInterface/Button";
import { Textarea } from "@/Components/UserInterface/Textarea";

type ChatComposerProps = {
  canSend: boolean;
  isBusy: boolean;
  isGenerating: boolean;
  placeholder?: string;
  onInterrupt: () => void | Promise<void>;
  onSend: (text: string) => void | Promise<void>;
};

const DEFAULT_PLACEHOLDER_TEXT = "Message Codex…";
const MAX_TEXTAREA_HEIGHT_PIXELS = 200;
const SUBMIT_DRAFT_KEY = "Enter";
const SEND_ACTION_LABEL = "Send";
const STOP_ACTION_LABEL = "Stop";

type DraftSubmissionState = {
  canSend: boolean;
  isBusy: boolean;
  draft: string;
};

function canSubmitDraft(state: DraftSubmissionState): boolean {
  return state.canSend && !state.isBusy && state.draft.trim().length > 0;
}

function isSubmitShortcutPressed(event: React.KeyboardEvent<HTMLTextAreaElement>): boolean {
  return event.key === SUBMIT_DRAFT_KEY && (event.metaKey || event.ctrlKey);
}

export function ChatComposer({
  canSend,
  isBusy,
  isGenerating,
  placeholder = DEFAULT_PLACEHOLDER_TEXT,
  onInterrupt,
  onSend,
}: ChatComposerProps): React.JSX.Element {
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const previousHeightRef = useRef(0);

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    // Keep draft growth bounded so long messages do not displace chat history.
    const nextHeight = Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT_PIXELS);
    const currentHeight = previousHeightRef.current;

    if (currentHeight <= 0) {
      textarea.style.height = `${nextHeight}px`;
      previousHeightRef.current = nextHeight;
      return;
    }

    if (nextHeight === currentHeight) {
      textarea.style.height = `${nextHeight}px`;
      return;
    }

    textarea.style.height = `${currentHeight}px`;

    if (resizeFrameRef.current !== null) {
      window.cancelAnimationFrame(resizeFrameRef.current);
    }

    resizeFrameRef.current = window.requestAnimationFrame(() => {
      if (!textareaRef.current) {
        return;
      }
      textareaRef.current.style.height = `${nextHeight}px`;
      resizeFrameRef.current = null;
    });
    previousHeightRef.current = nextHeight;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [resizeTextarea]);

  useEffect(() => {
    return () => {
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
      }
    };
  }, []);

  const sendDraft = useCallback(async () => {
    if (isGenerating) {
      await onInterrupt();
      return;
    }
    if (!canSubmitDraft({ canSend, isBusy, draft })) {
      return;
    }

    await onSend(draft);
    setDraft("");
    previousHeightRef.current = 0;
  }, [canSend, draft, isBusy, isGenerating, onInterrupt, onSend]);

  const canSubmitCurrentDraft = canSubmitDraft({ canSend, isBusy, draft });
  const disableSend = isGenerating ? !canSend || isBusy : !canSubmitCurrentDraft;
  const sendActionLabel = isGenerating ? STOP_ACTION_LABEL : SEND_ACTION_LABEL;

  return (
    <div className="flex items-end gap-2 rounded-[28px] border border-border bg-card pl-4 pr-2.5 py-2.5 focus-within:border-muted-foreground/40 transition-colors">
      <Textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          resizeTextarea();
        }}
        onKeyDown={(e) => {
          if (isSubmitShortcutPressed(e)) {
            e.preventDefault();
            void sendDraft();
          }
        }}
        placeholder={placeholder}
        rows={1}
        style={{ maxHeight: `${MAX_TEXTAREA_HEIGHT_PIXELS}px` }}
        className="flex-1 min-h-9 resize-none overflow-y-auto border-0 bg-transparent px-0 py-2 text-base leading-5 shadow-none transition-[height] duration-90 ease-out focus-visible:ring-0 md:text-sm"
      />
      <Button
        type="button"
        onClick={() => {
          void sendDraft();
        }}
        disabled={disableSend}
        title={sendActionLabel}
        aria-label={sendActionLabel}
        size="icon"
        className={`h-9 w-9 shrink-0 self-end rounded-full disabled:opacity-30 ${
          isGenerating
            ? "bg-destructive text-destructive-foreground hover:bg-destructive/85"
            : "bg-foreground text-background hover:bg-foreground/80"
        }`}
      >
        {isGenerating ? (
          <Square size={11} />
        ) : isBusy ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <ArrowUp size={13} />
        )}
      </Button>
    </div>
  );
}

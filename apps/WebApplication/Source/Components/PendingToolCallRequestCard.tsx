import { type ToolCallResponsePayload } from "@farfield/protocol";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Button } from "@/Components/UserInterface/Button";
import { Label } from "@/Components/UserInterface/Label";
import { Textarea } from "@/Components/UserInterface/Textarea";
import { type PendingToolCallRequest } from "@/Features/Chat/DomainModel/PendingToolCallRequestSelector";

const TOOL_RESPONSE_TEXTAREA_ID = "pending-tool-call-response";
const RESPONSE_TEXT_PLACEHOLDER = "Optional tool response text";
const EMPTY_ARGUMENTS_TEXT = "{}";

export interface PendingToolCallRequestCardProps {
  request: PendingToolCallRequest;
  onSubmitResponse: (payload: ToolCallResponsePayload) => void;
  isBusy: boolean;
}

function readTrimmedText(value: string): string {
  return value.trim();
}

function buildToolCallResponsePayload(
  success: boolean,
  responseTextDraft: string,
): ToolCallResponsePayload {
  const responseText = readTrimmedText(responseTextDraft);
  return {
    success,
    contentItems:
      responseText.length > 0
        ? [
            {
              type: "inputText",
              text: responseText,
            },
          ]
        : [],
  };
}

function readArgumentsPreviewText(
  argumentsValue: PendingToolCallRequest["params"]["arguments"],
): string {
  return JSON.stringify(argumentsValue, null, 2) ?? EMPTY_ARGUMENTS_TEXT;
}

export function PendingToolCallRequestCard({
  request,
  onSubmitResponse,
  isBusy,
}: PendingToolCallRequestCardProps): React.JSX.Element {
  const [responseTextDraft, setResponseTextDraft] = useState<string>("");

  useEffect(() => {
    setResponseTextDraft("");
  }, [request.id]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-4 space-y-3"
    >
      <div className="space-y-1">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
          Tool call request
        </div>
        <div className="text-sm text-foreground">
          <span className="font-medium">Tool:</span>{" "}
          <span className="font-mono">{request.params.tool}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          Call id: <span className="font-mono">{request.params.callId}</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={TOOL_RESPONSE_TEXTAREA_ID}>Response text</Label>
        <Textarea
          id={TOOL_RESPONSE_TEXTAREA_ID}
          value={responseTextDraft}
          onChange={(event) => {
            setResponseTextDraft(event.target.value);
          }}
          placeholder={RESPONSE_TEXT_PLACEHOLDER}
          className="min-h-[72px] bg-background text-base md:text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <div className="text-xs text-muted-foreground">Arguments</div>
        <pre className="rounded-md border border-border bg-background p-2 text-[11px] leading-relaxed whitespace-pre-wrap break-all text-muted-foreground">
          {readArgumentsPreviewText(request.params.arguments)}
        </pre>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          type="button"
          onClick={() => {
            onSubmitResponse(buildToolCallResponsePayload(true, responseTextDraft));
          }}
          disabled={isBusy}
          size="sm"
          className="h-8 text-xs"
        >
          Submit success
        </Button>
        <Button
          type="button"
          onClick={() => {
            onSubmitResponse(buildToolCallResponsePayload(false, responseTextDraft));
          }}
          disabled={isBusy}
          variant="destructive"
          size="sm"
          className="h-8 text-xs"
        >
          Submit failure
        </Button>
      </div>
    </motion.div>
  );
}

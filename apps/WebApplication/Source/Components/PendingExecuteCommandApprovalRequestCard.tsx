import { type DeprecatedApprovalReviewDecision } from "@farfield/protocol";
import { motion } from "framer-motion";
import { Button } from "@/Components/UserInterface/Button";
import { type PendingExecuteCommandApprovalRequest } from "@/Features/Chat/DomainModel/PendingExecuteCommandApprovalRequestSelector";

const EMPTY_PARAMETERS_TEXT = "{}";

export interface PendingExecuteCommandApprovalRequestCardProps {
  request: PendingExecuteCommandApprovalRequest;
  onSubmitDecision: (decision: DeprecatedApprovalReviewDecision) => void;
  isBusy: boolean;
}

function readParametersPreviewText(
  parameters: PendingExecuteCommandApprovalRequest["params"],
): string {
  return JSON.stringify(parameters, null, 2) ?? EMPTY_PARAMETERS_TEXT;
}

export function PendingExecuteCommandApprovalRequestCard({
  request,
  onSubmitDecision,
  isBusy,
}: PendingExecuteCommandApprovalRequestCardProps): React.JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-4 space-y-3"
    >
      <div className="space-y-1">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
          Deprecated exec-command approval request
        </div>
        <div className="text-xs text-muted-foreground">
          Compatibility request for older app-server approval flow.
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-xs text-muted-foreground">Request parameters</div>
        <pre className="rounded-md border border-border bg-background p-2 text-[11px] leading-relaxed whitespace-pre-wrap break-all text-muted-foreground">
          {readParametersPreviewText(request.params)}
        </pre>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          type="button"
          onClick={() => {
            onSubmitDecision("approved");
          }}
          disabled={isBusy}
          size="sm"
          className="h-8 text-xs"
        >
          Approve
        </Button>
        <Button
          type="button"
          onClick={() => {
            onSubmitDecision("approved_for_session");
          }}
          disabled={isBusy}
          variant="outline"
          size="sm"
          className="h-8 text-xs"
        >
          Approve for session
        </Button>
        <Button
          type="button"
          onClick={() => {
            onSubmitDecision("denied");
          }}
          disabled={isBusy}
          variant="outline"
          size="sm"
          className="h-8 text-xs"
        >
          Deny
        </Button>
        <Button
          type="button"
          onClick={() => {
            onSubmitDecision("abort");
          }}
          disabled={isBusy}
          variant="destructive"
          size="sm"
          className="h-8 text-xs"
        >
          Abort
        </Button>
      </div>
    </motion.div>
  );
}

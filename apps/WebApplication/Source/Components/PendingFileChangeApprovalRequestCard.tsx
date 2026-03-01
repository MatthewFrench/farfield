import { type FileChangeApprovalResponsePayload } from "@farfield/protocol";
import { motion } from "framer-motion";
import { Button } from "@/Components/UserInterface/Button";
import { type PendingFileChangeApprovalRequest } from "@/Features/Chat/DomainModel/PendingFileChangeApprovalRequestSelector";

const EMPTY_REASON_MESSAGE = "No reason was provided.";

export interface PendingFileChangeApprovalRequestCardProps {
  request: PendingFileChangeApprovalRequest;
  onSubmitDecision: (decision: FileChangeApprovalResponsePayload["decision"]) => void;
  isBusy: boolean;
}

function readReasonText(reason: string | null | undefined): string {
  if (reason !== null && reason !== undefined && reason.trim().length > 0) {
    return reason;
  }

  return EMPTY_REASON_MESSAGE;
}

export function PendingFileChangeApprovalRequestCard({
  request,
  onSubmitDecision,
  isBusy,
}: PendingFileChangeApprovalRequestCardProps): React.JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-4 space-y-3"
    >
      <div className="space-y-1">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
          File change approval request
        </div>
        <div className="text-xs text-muted-foreground">{readReasonText(request.params.reason)}</div>
        {request.params.grantRoot !== null && request.params.grantRoot !== undefined ? (
          <div className="text-xs text-muted-foreground">
            Requested root: <span className="font-mono">{request.params.grantRoot}</span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          type="button"
          onClick={() => {
            onSubmitDecision("accept");
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
            onSubmitDecision("acceptForSession");
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
            onSubmitDecision("decline");
          }}
          disabled={isBusy}
          variant="outline"
          size="sm"
          className="h-8 text-xs"
        >
          Decline
        </Button>
        <Button
          type="button"
          onClick={() => {
            onSubmitDecision("cancel");
          }}
          disabled={isBusy}
          variant="destructive"
          size="sm"
          className="h-8 text-xs"
        >
          Cancel turn
        </Button>
      </div>
    </motion.div>
  );
}

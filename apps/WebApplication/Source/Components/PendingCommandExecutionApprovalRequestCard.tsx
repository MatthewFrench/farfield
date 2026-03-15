import { type CommandExecutionApprovalResponsePayload } from "@farfield/protocol";
import { motion } from "framer-motion";
import { Button } from "@/Components/UserInterface/Button";
import { type PendingCommandExecutionApprovalRequest } from "@/Features/Chat/DomainModel/PendingCommandExecutionApprovalRequestSelector";

const EMPTY_REASON_MESSAGE = "No reason was provided.";
const EMPTY_COMMAND_MESSAGE = "No command was provided.";

export interface PendingCommandExecutionApprovalRequestCardProps {
  request: PendingCommandExecutionApprovalRequest;
  onSubmitDecision: (decision: CommandExecutionApprovalResponsePayload["decision"]) => void;
  isBusy: boolean;
}

function readCommandText(command: string | null | undefined): string {
  if (command !== null && command !== undefined && command.trim().length > 0) {
    return command;
  }

  return EMPTY_COMMAND_MESSAGE;
}

function readReasonText(reason: string | null | undefined): string {
  if (reason !== null && reason !== undefined && reason.trim().length > 0) {
    return reason;
  }

  return EMPTY_REASON_MESSAGE;
}

export function PendingCommandExecutionApprovalRequestCard({
  request,
  onSubmitDecision,
  isBusy,
}: PendingCommandExecutionApprovalRequestCardProps): React.JSX.Element {
  const proposedExecpolicyAmendment = request.params.proposedExecpolicyAmendment;
  const canAcceptWithProposedAmendment =
    proposedExecpolicyAmendment !== null &&
    proposedExecpolicyAmendment !== undefined &&
    proposedExecpolicyAmendment.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-4 space-y-3"
    >
      <div className="space-y-1">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
          Command approval request
        </div>
        <div className="text-sm text-foreground">
          <span className="font-medium">Command:</span>{" "}
          <span className="font-mono">{readCommandText(request.params.command)}</span>
        </div>
        <div className="text-xs text-muted-foreground">{readReasonText(request.params.reason)}</div>
        {request.params.cwd !== null && request.params.cwd !== undefined ? (
          <div className="text-xs text-muted-foreground">
            Working directory: <span className="font-mono">{request.params.cwd}</span>
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
        {canAcceptWithProposedAmendment ? (
          <Button
            type="button"
            onClick={() => {
              onSubmitDecision({
                acceptWithExecpolicyAmendment: {
                  execpolicy_amendment: proposedExecpolicyAmendment,
                },
              });
            }}
            disabled={isBusy}
            variant="outline"
            size="sm"
            className="h-8 text-xs"
          >
            Apply proposed policy
          </Button>
        ) : null}
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

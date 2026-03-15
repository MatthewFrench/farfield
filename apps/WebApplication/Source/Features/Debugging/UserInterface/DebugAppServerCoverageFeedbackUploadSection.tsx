import { useState } from "react";
import { Button } from "@/Components/UserInterface/Button";
import { type DebugAppServerCoverageFeedbackUploadResult } from "../DomainModel/DebugAppServerCoverageContracts";

export interface DebugAppServerCoverageFeedbackUploadSectionProps {
  isRunningCoverageAction: boolean;
  lastFeedbackUploadResult: DebugAppServerCoverageFeedbackUploadResult | null;
  onUploadFeedback: (
    classification: string,
    includeLogs: boolean,
    reason?: string,
    threadId?: string,
  ) => void;
}

/**
 * Owns debug coverage controls for feedback uploads.
 * Form fields map directly to feedback/upload parameters so operators can verify request behavior.
 */
export function DebugAppServerCoverageFeedbackUploadSection({
  isRunningCoverageAction,
  lastFeedbackUploadResult,
  onUploadFeedback,
}: DebugAppServerCoverageFeedbackUploadSectionProps): React.JSX.Element {
  const [feedbackClassification, setFeedbackClassification] = useState("bug");
  const [feedbackReason, setFeedbackReason] = useState("");
  const [feedbackThreadId, setFeedbackThreadId] = useState("");
  const [includeLogs, setIncludeLogs] = useState(true);

  const runFeedbackUpload = (): void => {
    onUploadFeedback(
      feedbackClassification,
      includeLogs,
      feedbackReason.trim().length > 0 ? feedbackReason : undefined,
      feedbackThreadId.trim().length > 0 ? feedbackThreadId : undefined,
    );
  };

  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Feedback Upload
        </h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="debug-coverage-feedback-upload-run"
          disabled={isRunningCoverageAction}
          onClick={runFeedbackUpload}
        >
          Upload Feedback
        </Button>
      </div>
      <div className="space-y-2">
        <label
          className="text-xs text-muted-foreground"
          htmlFor="debug-coverage-feedback-classification"
        >
          Classification
        </label>
        <input
          id="debug-coverage-feedback-classification"
          type="text"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
          value={feedbackClassification}
          onChange={(event) => {
            setFeedbackClassification(event.target.value);
          }}
        />
        <label className="text-xs text-muted-foreground" htmlFor="debug-coverage-feedback-reason">
          Reason (optional)
        </label>
        <textarea
          id="debug-coverage-feedback-reason"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs min-h-16"
          value={feedbackReason}
          onChange={(event) => {
            setFeedbackReason(event.target.value);
          }}
        />
        <label
          className="text-xs text-muted-foreground"
          htmlFor="debug-coverage-feedback-thread-id"
        >
          Thread ID (optional)
        </label>
        <input
          id="debug-coverage-feedback-thread-id"
          type="text"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
          value={feedbackThreadId}
          onChange={(event) => {
            setFeedbackThreadId(event.target.value);
          }}
        />
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            id="debug-coverage-feedback-include-logs"
            type="checkbox"
            checked={includeLogs}
            onChange={(event) => {
              setIncludeLogs(event.target.checked);
            }}
          />
          Include logs
        </label>
      </div>
      {lastFeedbackUploadResult === null ? (
        <p className="text-xs text-muted-foreground">No feedback upload captured.</p>
      ) : (
        <div
          className="rounded border border-border/70 p-2 text-xs space-y-1"
          data-testid="debug-coverage-feedback-upload-result"
        >
          <p>Classification: {lastFeedbackUploadResult.classification}</p>
          <p>Include logs: {lastFeedbackUploadResult.includeLogs ? "Yes" : "No"}</p>
          <p>Requested thread id: {lastFeedbackUploadResult.requestedThreadId ?? "None"}</p>
          <p>Reported thread id: {lastFeedbackUploadResult.reportedThreadId}</p>
          <p>Reason: {lastFeedbackUploadResult.reason ?? "None"}</p>
          <p>
            Uploaded: {new Date(lastFeedbackUploadResult.uploadedAtIso8601).toLocaleTimeString()}
          </p>
        </div>
      )}
    </div>
  );
}

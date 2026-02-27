import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/Components/UserInterface/Button";
import { type ErrorBannerDetails } from "@/Features/Debugging/DomainModel/DebugIssueContracts";

interface LiveStateReductionErrorSummary {
  eventIndex: number | null;
  patchIndex: number | null;
}

const ERROR_BANNER_OPEN_DEBUG_BUTTON_LABEL = "Open in Debug";
const LIVE_STATE_REDUCTION_WARNING_MESSAGE =
  "Live updates failed for this thread. Showing saved messages only.";

export interface DebugStatusBannersProps {
  activeTab: "chat" | "debug";
  errorMessage: string;
  errorBannerDetails: ErrorBannerDetails;
  onOpenDebugFromErrorBanner: () => void;
  onDismissErrorBanner: () => void;
  liveStateReductionError: LiveStateReductionErrorSummary | null;
}

export function DebugStatusBanners({
  activeTab,
  errorMessage,
  errorBannerDetails,
  onOpenDebugFromErrorBanner,
  onDismissErrorBanner,
  liveStateReductionError,
}: DebugStatusBannersProps): React.JSX.Element {
  return (
    <>
      <AnimatePresence>
        {errorMessage.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            data-testid="error-banner"
            className="relative z-30 overflow-hidden shrink-0"
          >
            <div className="flex items-center justify-between px-4 py-2 bg-destructive border-b border-destructive/80 text-sm text-destructive-foreground">
              <div className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
                {errorBannerDetails.operation.length > 0 && (
                  <span data-testid="error-banner-operation" className="shrink-0 font-semibold">
                    {errorBannerDetails.operation}:
                  </span>
                )}
                <span data-testid="error-banner-message" className="truncate">
                  {errorBannerDetails.message}
                </span>
                {errorBannerDetails.actionId !== null && errorBannerDetails.actionId.length > 0 && (
                  <span
                    data-testid="error-banner-action-id"
                    className="hidden sm:inline-flex font-mono text-[11px] px-1 py-0.5 rounded bg-black/15"
                  >
                    action {errorBannerDetails.actionId}
                  </span>
                )}
                {errorBannerDetails.requestId !== null &&
                  errorBannerDetails.requestId.length > 0 && (
                    <span
                      data-testid="error-banner-request-id"
                      className="hidden sm:inline-flex font-mono text-[11px] px-1 py-0.5 rounded bg-black/15"
                    >
                      request {errorBannerDetails.requestId}
                    </span>
                  )}
                {errorBannerDetails.errorId !== null && errorBannerDetails.errorId.length > 0 && (
                  <span
                    data-testid="error-banner-error-id"
                    className="hidden sm:inline-flex font-mono text-[11px] px-1 py-0.5 rounded bg-black/15"
                  >
                    error {errorBannerDetails.errorId}
                  </span>
                )}
              </div>
              <div className="ml-3 flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  data-testid="error-banner-open-debug"
                  onClick={() => {
                    onOpenDebugFromErrorBanner();
                    onDismissErrorBanner();
                  }}
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-destructive-foreground/90 hover:text-destructive-foreground hover:bg-black/10"
                >
                  {ERROR_BANNER_OPEN_DEBUG_BUTTON_LABEL}
                </Button>
                <Button
                  type="button"
                  data-testid="error-banner-dismiss"
                  onClick={onDismissErrorBanner}
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 text-destructive-foreground/70 hover:text-destructive-foreground hover:bg-black/10"
                >
                  <X size={13} />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {liveStateReductionError && activeTab === "chat" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="relative z-30 overflow-hidden shrink-0"
          >
            <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 text-sm text-amber-200">
              {LIVE_STATE_REDUCTION_WARNING_MESSAGE}
              {liveStateReductionError.eventIndex !== null && (
                <span className="ml-2 text-xs text-amber-300/90">
                  event {liveStateReductionError.eventIndex}
                </span>
              )}
              {liveStateReductionError.patchIndex !== null && (
                <span className="ml-1 text-xs text-amber-300/90">
                  patch {liveStateReductionError.patchIndex}
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

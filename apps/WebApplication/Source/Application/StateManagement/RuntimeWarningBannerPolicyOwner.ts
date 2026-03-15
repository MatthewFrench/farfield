import {
  type ThreadRuntimeWarningSeverity,
  type ThreadRuntimeWarningSummary,
} from "@/Features/Threads/DomainModel/ThreadRuntimeStatusContracts";
import { type RuntimeWarningEvent } from "./RuntimeNotificationProjectionParser";
import { readThreadRuntimeWarningSummary } from "./ThreadSidebarRuntimeSummaryProjection";

interface ReadNextWarningSummaryInput {
  previousSummary: ThreadRuntimeWarningSummary | null;
  latestWarningEvent: RuntimeWarningEvent | null;
  resetRequired: boolean;
}

const WARNING_DEDUPLICATION_WINDOW_MILLISECONDS = 1_500;
const SUCCESS_WARNING_TTL_MILLISECONDS = 7_500;
const INFO_WARNING_TTL_MILLISECONDS = 12_000;
const REALTIME_WARNING_TTL_MILLISECONDS = 15_000;
const WARNING_WARNING_TTL_MILLISECONDS = 15_000;
const ERROR_WARNING_TTL_MILLISECONDS = 20_000;

/**
 * Owns runtime warning-banner policy decisions: thread-switch clearing, priority selection,
 * deduplication windows, and time-to-live expiration.
 */
export class RuntimeWarningBannerPolicyOwner {
  private readonly readNowMilliseconds: () => number;
  private selectedThreadId: string | null;

  public constructor(readNowMilliseconds?: () => number) {
    this.readNowMilliseconds = readNowMilliseconds ?? (() => Date.now());
    this.selectedThreadId = null;
  }

  public resetSelectedThread(nextSelectedThreadId: string | null): void {
    this.selectedThreadId = nextSelectedThreadId;
  }

  public readThreadSwitchRequiresWarningClear(nextSelectedThreadId: string | null): boolean {
    if (this.selectedThreadId === nextSelectedThreadId) {
      return false;
    }
    this.selectedThreadId = nextSelectedThreadId;
    return true;
  }

  public readNextWarningSummary(
    input: ReadNextWarningSummaryInput,
  ): ThreadRuntimeWarningSummary | null {
    const nowMilliseconds = this.readNowMilliseconds();
    const baselineSummary = input.resetRequired
      ? null
      : this.readNonExpiredSummary(input.previousSummary, nowMilliseconds);

    if (input.latestWarningEvent === null) {
      return baselineSummary;
    }

    const candidateSummary = readThreadRuntimeWarningSummary(input.latestWarningEvent);
    if (baselineSummary === null) {
      return candidateSummary;
    }

    if (this.readShouldDedupeSummary(baselineSummary, candidateSummary)) {
      return baselineSummary;
    }

    const candidatePriority = readSeverityPriority(candidateSummary.severity);
    const baselinePriority = readSeverityPriority(baselineSummary.severity);
    if (candidatePriority < baselinePriority) {
      return baselineSummary;
    }

    return candidateSummary;
  }

  private readShouldDedupeSummary(
    baselineSummary: ThreadRuntimeWarningSummary,
    candidateSummary: ThreadRuntimeWarningSummary,
  ): boolean {
    const isEquivalentSummary =
      baselineSummary.method === candidateSummary.method &&
      baselineSummary.severity === candidateSummary.severity &&
      baselineSummary.summary === candidateSummary.summary &&
      baselineSummary.threadId === candidateSummary.threadId &&
      baselineSummary.isRetrying === candidateSummary.isRetrying;
    if (!isEquivalentSummary) {
      return false;
    }

    const receivedAtDifference = Math.abs(
      candidateSummary.receivedAtMilliseconds - baselineSummary.receivedAtMilliseconds,
    );
    return receivedAtDifference <= WARNING_DEDUPLICATION_WINDOW_MILLISECONDS;
  }

  private readNonExpiredSummary(
    summary: ThreadRuntimeWarningSummary | null,
    nowMilliseconds: number,
  ): ThreadRuntimeWarningSummary | null {
    if (summary === null) {
      return null;
    }
    const summaryAgeMilliseconds = nowMilliseconds - summary.refreshedAtMilliseconds;
    if (summaryAgeMilliseconds >= readSeverityTimeToLiveMilliseconds(summary.severity)) {
      return null;
    }
    return summary;
  }
}

function readSeverityPriority(severity: ThreadRuntimeWarningSeverity): number {
  if (severity === "error") {
    return 5;
  }
  if (severity === "warning") {
    return 4;
  }
  if (severity === "realtime") {
    return 3;
  }
  if (severity === "info") {
    return 2;
  }
  return 1;
}

function readSeverityTimeToLiveMilliseconds(severity: ThreadRuntimeWarningSeverity): number {
  if (severity === "error") {
    return ERROR_WARNING_TTL_MILLISECONDS;
  }
  if (severity === "warning") {
    return WARNING_WARNING_TTL_MILLISECONDS;
  }
  if (severity === "realtime") {
    return REALTIME_WARNING_TTL_MILLISECONDS;
  }
  if (severity === "info") {
    return INFO_WARNING_TTL_MILLISECONDS;
  }
  return SUCCESS_WARNING_TTL_MILLISECONDS;
}

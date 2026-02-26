import {
  reportClientError,
  type ClientErrorReportInput,
  type ClientErrorReportResult
} from "@/Features/Debugging/DataAccess/ClientErrorReporter";
import {
  type FarfieldHttpRequestFailureDetails
} from "@/Shared/Transport/FarfieldHttpTransport";
import { z } from "zod";
import { toErrorMessage } from "@/Shared/Errors/ErrorMessage";
import {
  extractRequestIdFromErrorMessage,
  formatTrackedUiErrorMessage,
  shouldIgnoreUiErrorMessage
} from "@/Features/Debugging/StateManagement/TrackedUserInterfaceErrorPolicy";

type ErrorInput = Error | string | number | boolean | bigint | symbol | null | undefined | object;

export interface TrackedUserInterfaceErrorReportInput {
  operation: string;
  actionId: string;
  threadId: string | null;
  error: ErrorInput;
  details?: Record<string, string | number | boolean | null>;
}

interface TrackedUserInterfaceErrorReporterDependencies {
  setErrorMessage: (errorMessage: string) => void;
  reportClientErrorFn?: (input: ClientErrorReportInput) => Promise<ClientErrorReportResult>;
  readPathnameAndSearch?: () => string;
  readNow?: () => number;
  reportDeduplicationWindowMs?: number;
}

const RequestFailureDetailsSchema = z.object({
  path: z.string().trim().min(1),
  status: z.number().int().nullable(),
  statusText: z.string().trim().min(1).nullable(),
  requestId: z.string().trim().min(1).nullable(),
  responseText: z.string().trim().min(1).nullable(),
  responseTextLength: z.number().int().positive().nullable().optional().default(null),
  responseTextTruncated: z.boolean().optional().default(false)
});

const RequestFailureErrorSchema = z.object({
  requestFailureDetails: RequestFailureDetailsSchema
}).passthrough();

const DEFAULT_REPORT_DEDUPLICATION_WINDOW_MILLISECONDS = 15_000;
const CLIENT_ERROR_SOURCE = "farfield-web";
const CLIENT_ERROR_SEVERITY = "error";
const REPORT_KEY_SEGMENT_SEPARATOR = "|";
const REPORT_KEY_MISSING_REQUEST_IDENTIFIER = "no-request-id";
const REPORT_KEY_MISSING_THREAD_IDENTIFIER = "no-thread-id";
const CLIENT_ERROR_DETAIL_ACTION_IDENTIFIER_KEY = "actionId";
const CLIENT_ERROR_DETAIL_ACTION_NAME_KEY = "actionName";
const CLIENT_ERROR_DETAIL_PATH_KEY = "path";
const CLIENT_ERROR_DETAIL_REQUEST_STATUS_KEY = "requestStatus";
const CLIENT_ERROR_DETAIL_REQUEST_STATUS_TEXT_KEY = "requestStatusText";
const CLIENT_ERROR_DETAIL_RESPONSE_TEXT_KEY = "responseText";
const CLIENT_ERROR_DETAIL_RESPONSE_TEXT_LENGTH_KEY = "responseTextLength";
const CLIENT_ERROR_DETAIL_RESPONSE_TEXT_TRUNCATED_KEY = "responseTextTruncated";

export class TrackedUserInterfaceErrorReporter {
  private readonly reportDeduplicationWindowMs: number;
  private readonly setErrorMessage: (errorMessage: string) => void;
  private readonly reportClientErrorFn: (input: ClientErrorReportInput) => Promise<ClientErrorReportResult>;
  private readonly readPathnameAndSearch: () => string;
  private readonly readNow: () => number;
  private readonly mostRecentErrorReportTimestampByKey: Map<string, number>;

  public constructor(dependencies: TrackedUserInterfaceErrorReporterDependencies) {
    const reportDeduplicationWindowMs = dependencies.reportDeduplicationWindowMs
      ?? DEFAULT_REPORT_DEDUPLICATION_WINDOW_MILLISECONDS;
    if (!Number.isInteger(reportDeduplicationWindowMs) || reportDeduplicationWindowMs <= 0) {
      throw new Error("reportDeduplicationWindowMs must be a positive integer");
    }

    this.reportDeduplicationWindowMs = reportDeduplicationWindowMs;
    this.setErrorMessage = dependencies.setErrorMessage;
    this.reportClientErrorFn = dependencies.reportClientErrorFn ?? reportClientError;
    this.readPathnameAndSearch = dependencies.readPathnameAndSearch
      ?? (() => window.location.pathname + window.location.search);
    this.readNow = dependencies.readNow ?? (() => Date.now());
    this.mostRecentErrorReportTimestampByKey = new Map<string, number>();
  }

  public async report(input: TrackedUserInterfaceErrorReportInput): Promise<void> {
    const errorMessage = toErrorMessage(input.error);
    if (shouldIgnoreUiErrorMessage(errorMessage)) {
      return;
    }

    const parsedRequestFailureError = RequestFailureErrorSchema.safeParse(input.error);
    const requestFailureDetails: FarfieldHttpRequestFailureDetails | null = parsedRequestFailureError.success
      ? parsedRequestFailureError.data.requestFailureDetails
      : null;
    const requestId = requestFailureDetails?.requestId ?? extractRequestIdFromErrorMessage(errorMessage);
    if (this.shouldSkipDuplicateErrorReport({
      operation: input.operation,
      errorMessage,
      requestId,
      threadId: input.threadId
    })) {
      return;
    }

    const details: Record<string, string | number | boolean | null> = {
      ...(input.details ?? {})
    };
    details[CLIENT_ERROR_DETAIL_ACTION_IDENTIFIER_KEY] = input.actionId;
    details[CLIENT_ERROR_DETAIL_ACTION_NAME_KEY] = input.operation;

    if (requestFailureDetails !== null) {
      details[CLIENT_ERROR_DETAIL_PATH_KEY] = requestFailureDetails.path;
      details[CLIENT_ERROR_DETAIL_REQUEST_STATUS_KEY] = requestFailureDetails.status;
      details[CLIENT_ERROR_DETAIL_REQUEST_STATUS_TEXT_KEY] = requestFailureDetails.statusText;
      details[CLIENT_ERROR_DETAIL_RESPONSE_TEXT_KEY] = requestFailureDetails.responseText;
      details[CLIENT_ERROR_DETAIL_RESPONSE_TEXT_LENGTH_KEY] = requestFailureDetails.responseTextLength;
      details[CLIENT_ERROR_DETAIL_RESPONSE_TEXT_TRUNCATED_KEY] = requestFailureDetails.responseTextTruncated;
    }

    let errorId: string | null = null;
    try {
      const report = await this.reportClientErrorFn({
        source: CLIENT_ERROR_SOURCE,
        operation: input.operation,
        message: errorMessage,
        severity: CLIENT_ERROR_SEVERITY,
        name: null,
        stack: null,
        requestId,
        threadId: input.threadId,
        url: this.readPathnameAndSearch(),
        details
      });
      errorId = report.errorId;
    } catch {
      errorId = null;
    }

    this.setErrorMessage(formatTrackedUiErrorMessage({
      operation: input.operation,
      errorMessage,
      actionId: input.actionId,
      requestId,
      errorId
    }));
  }

  private shouldSkipDuplicateErrorReport(input: {
    operation: string;
    errorMessage: string;
    requestId: string | null;
    threadId: string | null;
  }): boolean {
    const now = this.readNow();
    this.pruneExpiredReportKeys(now);
    const reportKey = this.createReportKey(input);
    const previousReportTimestamp = this.mostRecentErrorReportTimestampByKey.get(reportKey);
    const hasReportInDeduplicationWindow = previousReportTimestamp !== undefined;
    if (hasReportInDeduplicationWindow) {
      this.mostRecentErrorReportTimestampByKey.set(reportKey, now);
      return true;
    }
    this.mostRecentErrorReportTimestampByKey.set(reportKey, now);
    return false;
  }

  private pruneExpiredReportKeys(now: number): void {
    for (const [reportKey, reportedAt] of this.mostRecentErrorReportTimestampByKey.entries()) {
      if (now - reportedAt < this.reportDeduplicationWindowMs) {
        continue;
      }
      this.mostRecentErrorReportTimestampByKey.delete(reportKey);
    }
  }

  private createReportKey(input: {
    operation: string;
    errorMessage: string;
    requestId: string | null;
    threadId: string | null;
  }): string {
    const requestIdentifier = input.requestId ?? REPORT_KEY_MISSING_REQUEST_IDENTIFIER;
    const threadIdentifier = input.threadId ?? REPORT_KEY_MISSING_THREAD_IDENTIFIER;
    return [
      input.operation,
      requestIdentifier,
      threadIdentifier,
      input.errorMessage
    ].join(REPORT_KEY_SEGMENT_SEPARATOR);
  }
}

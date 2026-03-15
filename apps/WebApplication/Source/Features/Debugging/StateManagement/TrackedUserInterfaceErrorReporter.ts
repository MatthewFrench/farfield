/**
 * Owns tracked user-interface error reporting for action handlers, including short-window
 * deduplication and deterministic error-banner message formatting.
 */

import { z } from "zod";
import {
  type ClientErrorReportInput,
  type ClientErrorReportResult,
  reportClientError,
} from "@/Features/Debugging/DataAccess/ClientErrorReporter";
import {
  extractRequestIdFromErrorMessage,
  formatTrackedUiErrorMessage,
  shouldIgnoreUiErrorMessage,
} from "@/Features/Debugging/StateManagement/TrackedUserInterfaceErrorPolicy";
import { type FarfieldHttpRequestFailureDetails } from "@/Shared/Contracts/FarfieldHttpRequestFailureDetails";
import { toErrorMessage } from "@/Shared/Errors/ErrorMessage";

type ClientErrorDetailValue = string | number | boolean | null;
type ErrorInput = Error | string | number | boolean | bigint | symbol | null | undefined | object;
type ClientErrorDetails = Record<string, ClientErrorDetailValue>;

export interface TrackedUserInterfaceErrorReportInput {
  operation: string;
  actionId: string;
  threadId: string | null;
  error: ErrorInput;
  details?: ClientErrorDetails;
}

interface TrackedUserInterfaceErrorReporterDependencies {
  setErrorMessage: (errorMessage: string) => void;
  reportClientErrorFn?: (input: ClientErrorReportInput) => Promise<ClientErrorReportResult>;
  readPathnameAndSearch?: () => string;
  readNow?: () => number;
  reportDeduplicationWindowMs?: number;
}

interface ParsedErrorContext {
  errorMessage: string;
  requestFailureDetails: FarfieldHttpRequestFailureDetails | null;
  requestId: string | null;
}

interface DeduplicationKeyInput {
  operation: string;
  errorMessage: string;
  requestId: string | null;
  threadId: string | null;
}

interface RemoteErrorReportInput {
  operation: string;
  threadId: string | null;
  errorMessage: string;
  requestId: string | null;
  details: ClientErrorDetails;
}

const RequestFailureDetailsSchema = z.object({
  path: z.string().trim().min(1),
  status: z.number().int().nullable(),
  statusText: z.string().trim().min(1).nullable(),
  requestId: z.string().trim().min(1).nullable(),
  responseText: z.string().trim().min(1).nullable(),
  responseTextLength: z.number().int().positive().nullable().optional().default(null),
  responseTextTruncated: z.boolean().optional().default(false),
});

const RequestFailureErrorSchema = z
  .object({
    requestFailureDetails: RequestFailureDetailsSchema,
  })
  .passthrough();

const ReportDeduplicationWindowMillisecondsSchema = z.number().int().positive();
const DEFAULT_REPORT_DEDUPLICATION_WINDOW_MILLISECONDS = 15_000;
const REPORT_DEDUPLICATION_WINDOW_VALIDATION_ERROR_MESSAGE =
  "reportDeduplicationWindowMs must be a positive integer";
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

function readValidatedReportDeduplicationWindowMilliseconds(value: number): number {
  const parsedWindow = ReportDeduplicationWindowMillisecondsSchema.safeParse(value);
  if (!parsedWindow.success) {
    throw new Error(REPORT_DEDUPLICATION_WINDOW_VALIDATION_ERROR_MESSAGE);
  }
  return parsedWindow.data;
}

export class TrackedUserInterfaceErrorReporter {
  private readonly reportDeduplicationWindowMs: number;
  private readonly setErrorMessage: (errorMessage: string) => void;
  private readonly reportClientErrorFn: (
    input: ClientErrorReportInput,
  ) => Promise<ClientErrorReportResult>;
  private readonly readPathnameAndSearch: () => string;
  private readonly readNow: () => number;
  private readonly mostRecentErrorReportTimestampByKey: Map<string, number>;

  public constructor(dependencies: TrackedUserInterfaceErrorReporterDependencies) {
    // Keep a small default suppression window so repeated action errors do not flood remote diagnostics.
    const reportDeduplicationWindowMs =
      dependencies.reportDeduplicationWindowMs ?? DEFAULT_REPORT_DEDUPLICATION_WINDOW_MILLISECONDS;

    this.reportDeduplicationWindowMs = readValidatedReportDeduplicationWindowMilliseconds(
      reportDeduplicationWindowMs,
    );
    this.setErrorMessage = dependencies.setErrorMessage;
    this.reportClientErrorFn = dependencies.reportClientErrorFn ?? reportClientError;
    this.readPathnameAndSearch =
      dependencies.readPathnameAndSearch ??
      (() => window.location.pathname + window.location.search);
    this.readNow = dependencies.readNow ?? (() => Date.now());
    this.mostRecentErrorReportTimestampByKey = new Map<string, number>();
  }

  public async report(input: TrackedUserInterfaceErrorReportInput): Promise<void> {
    const parsedErrorContext = this.readParsedErrorContext(input.error);
    if (shouldIgnoreUiErrorMessage(parsedErrorContext.errorMessage)) {
      return;
    }

    if (
      this.shouldSkipDuplicateErrorReport({
        operation: input.operation,
        errorMessage: parsedErrorContext.errorMessage,
        requestId: parsedErrorContext.requestId,
        threadId: input.threadId,
      })
    ) {
      return;
    }

    const details = this.createClientErrorDetails(input, parsedErrorContext.requestFailureDetails);
    const errorId = await this.reportRemoteClientError({
      operation: input.operation,
      threadId: input.threadId,
      errorMessage: parsedErrorContext.errorMessage,
      requestId: parsedErrorContext.requestId,
      details,
    });

    this.setErrorMessage(
      formatTrackedUiErrorMessage({
        operation: input.operation,
        errorMessage: parsedErrorContext.errorMessage,
        actionId: input.actionId,
        requestId: parsedErrorContext.requestId,
        errorId,
      }),
    );
  }

  private readParsedErrorContext(error: ErrorInput): ParsedErrorContext {
    const errorMessage = toErrorMessage(error);
    const parsedRequestFailureError = RequestFailureErrorSchema.safeParse(error);
    const requestFailureDetails = parsedRequestFailureError.success
      ? parsedRequestFailureError.data.requestFailureDetails
      : null;

    return {
      errorMessage,
      requestFailureDetails,
      requestId: requestFailureDetails?.requestId ?? extractRequestIdFromErrorMessage(errorMessage),
    };
  }

  private createClientErrorDetails(
    input: TrackedUserInterfaceErrorReportInput,
    requestFailureDetails: FarfieldHttpRequestFailureDetails | null,
  ): ClientErrorDetails {
    const details: ClientErrorDetails = {
      ...(input.details ?? {}),
    };
    details[CLIENT_ERROR_DETAIL_ACTION_IDENTIFIER_KEY] = input.actionId;
    details[CLIENT_ERROR_DETAIL_ACTION_NAME_KEY] = input.operation;

    if (requestFailureDetails !== null) {
      details[CLIENT_ERROR_DETAIL_PATH_KEY] = requestFailureDetails.path;
      details[CLIENT_ERROR_DETAIL_REQUEST_STATUS_KEY] = requestFailureDetails.status;
      details[CLIENT_ERROR_DETAIL_REQUEST_STATUS_TEXT_KEY] = requestFailureDetails.statusText;
      details[CLIENT_ERROR_DETAIL_RESPONSE_TEXT_KEY] = requestFailureDetails.responseText;
      details[CLIENT_ERROR_DETAIL_RESPONSE_TEXT_LENGTH_KEY] =
        requestFailureDetails.responseTextLength;
      details[CLIENT_ERROR_DETAIL_RESPONSE_TEXT_TRUNCATED_KEY] =
        requestFailureDetails.responseTextTruncated;
    }

    return details;
  }

  private async reportRemoteClientError(input: RemoteErrorReportInput): Promise<string | null> {
    try {
      const report = await this.reportClientErrorFn({
        source: CLIENT_ERROR_SOURCE,
        operation: input.operation,
        message: input.errorMessage,
        severity: CLIENT_ERROR_SEVERITY,
        name: null,
        stack: null,
        requestId: input.requestId,
        threadId: input.threadId,
        url: this.readPathnameAndSearch(),
        details: input.details,
      });
      return report.errorId;
    } catch {
      return null;
    }
  }

  private shouldSkipDuplicateErrorReport(input: DeduplicationKeyInput): boolean {
    const now = this.readNow();
    this.pruneExpiredReportKeys(now);
    const reportKey = this.createReportKey(input);
    const previousReportTimestamp = this.mostRecentErrorReportTimestampByKey.get(reportKey);
    const hasReportInDeduplicationWindow = previousReportTimestamp !== undefined;
    if (hasReportInDeduplicationWindow) {
      // Refresh duplicate keys so bursty retries remain suppressed until the activity quiets down.
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

  private createReportKey(input: DeduplicationKeyInput): string {
    const requestIdentifier = input.requestId ?? REPORT_KEY_MISSING_REQUEST_IDENTIFIER;
    const threadIdentifier = input.threadId ?? REPORT_KEY_MISSING_THREAD_IDENTIFIER;
    return [input.operation, requestIdentifier, threadIdentifier, input.errorMessage].join(
      REPORT_KEY_SEGMENT_SEPARATOR,
    );
  }
}

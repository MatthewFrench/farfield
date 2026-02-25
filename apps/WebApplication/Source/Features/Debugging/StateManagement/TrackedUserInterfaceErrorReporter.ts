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

export class TrackedUserInterfaceErrorReporter {
  private readonly reportDeduplicationWindowMs: number;
  private readonly setErrorMessage: (errorMessage: string) => void;
  private readonly reportClientErrorFn: (input: ClientErrorReportInput) => Promise<ClientErrorReportResult>;
  private readonly readPathnameAndSearch: () => string;
  private readonly readNow: () => number;
  private readonly mostRecentErrorReportTimestampByKey: Map<string, number>;

  public constructor(dependencies: TrackedUserInterfaceErrorReporterDependencies) {
    const reportDeduplicationWindowMs = dependencies.reportDeduplicationWindowMs ?? 15_000;
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
      actionId: input.actionId,
      actionName: input.operation,
      ...(input.details ?? {})
    };

    if (requestFailureDetails !== null) {
      details["path"] = requestFailureDetails.path;
      details["requestStatus"] = requestFailureDetails.status;
      details["requestStatusText"] = requestFailureDetails.statusText;
      details["responseText"] = requestFailureDetails.responseText;
      details["responseTextLength"] = requestFailureDetails.responseTextLength;
      details["responseTextTruncated"] = requestFailureDetails.responseTextTruncated;
    }

    let errorId: string | null = null;
    try {
      const report = await this.reportClientErrorFn({
        source: "farfield-web",
        operation: input.operation,
        message: errorMessage,
        severity: "error",
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
    if (typeof previousReportTimestamp === "number") {
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
    const requestIdentifier = input.requestId ?? "no-request-id";
    const threadIdentifier = input.threadId ?? "no-thread-id";
    return `${input.operation}|${requestIdentifier}|${threadIdentifier}|${input.errorMessage}`;
  }
}

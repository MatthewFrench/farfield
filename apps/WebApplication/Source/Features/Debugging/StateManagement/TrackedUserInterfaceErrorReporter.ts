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
}

const RequestFailureDetailsSchema = z.object({
  path: z.string().trim().min(1),
  status: z.number().int().nullable(),
  statusText: z.string().trim().min(1).nullable(),
  requestId: z.string().trim().min(1).nullable(),
  responseText: z.string().trim().min(1).nullable()
});

const RequestFailureErrorSchema = z.object({
  requestFailureDetails: RequestFailureDetailsSchema
}).passthrough();

export class TrackedUserInterfaceErrorReporter {
  private readonly setErrorMessage: (errorMessage: string) => void;
  private readonly reportClientErrorFn: (input: ClientErrorReportInput) => Promise<ClientErrorReportResult>;
  private readonly readPathnameAndSearch: () => string;

  public constructor(dependencies: TrackedUserInterfaceErrorReporterDependencies) {
    this.setErrorMessage = dependencies.setErrorMessage;
    this.reportClientErrorFn = dependencies.reportClientErrorFn ?? reportClientError;
    this.readPathnameAndSearch = dependencies.readPathnameAndSearch
      ?? (() => window.location.pathname + window.location.search);
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
}

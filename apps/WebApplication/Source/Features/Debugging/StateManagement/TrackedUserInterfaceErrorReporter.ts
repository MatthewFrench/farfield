import {
  reportClientError,
  type ClientErrorReportInput,
  type ClientErrorReportResult
} from "@/Features/Debugging/DataAccess/ClientErrorReporter";
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

    const requestId = extractRequestIdFromErrorMessage(errorMessage);
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
        details: {
          actionId: input.actionId,
          actionName: input.operation,
          ...(input.details ?? {})
        }
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

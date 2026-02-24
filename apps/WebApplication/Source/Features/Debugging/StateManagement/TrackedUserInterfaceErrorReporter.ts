import {
  reportClientError,
  type ClientErrorReportInput,
  type ClientErrorReportResult
} from "@/SharedUtilities/ClientErrors";
import {
  extractRequestIdFromErrorMessage,
  formatTrackedUiErrorMessage,
  shouldIgnoreUiErrorMessage,
  toErrorMessage
} from "@/SharedUtilities/DebugHelpers";

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

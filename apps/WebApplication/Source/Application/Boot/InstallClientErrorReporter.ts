import { z } from "zod";
import {
  type ClientErrorReportInput,
  reportClientError,
} from "@/Features/Debugging/DataAccess/ClientErrorReporter";

type BrowserErrorReason = ErrorEvent["error"] | PromiseRejectionEvent["reason"];

interface NormalizedBrowserError {
  message: string;
  name: string | null;
  stack: string | null;
}

export interface GlobalClientCrashReporterOptions {
  source: string;
  readThreadId?: () => string | null;
  readUrl?: () => string | null;
}

export interface GlobalClientCrashReporterHandle {
  remove: () => void;
}

const NonEmptyStringSchema = z.string().trim().min(1);
const OptionalNonEmptyStringSchema = z.string().trim().min(1).nullable().optional();
const ErrorObjectSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    message: z.string().trim().min(1).optional(),
    stack: z.string().trim().min(1).optional(),
  })
  .passthrough();
const NonSymbolPrimitiveReasonSchema = z.union([z.number(), z.boolean(), z.bigint()]);
const SymbolReasonSchema = z.symbol();

const WINDOW_ERROR_OPERATION = "window-error";
const WINDOW_UNHANDLED_REJECTION_OPERATION = "window-unhandledrejection";
const UNHANDLED_BROWSER_ERROR_MESSAGE = "Unhandled browser error";
const UNHANDLED_PROMISE_REJECTION_MESSAGE = "Unhandled promise rejection";

function parseOptionalText(value: string | null | undefined): string | null {
  const parsed = OptionalNonEmptyStringSchema.safeParse(value ?? null);
  return parsed.success ? (parsed.data ?? null) : null;
}

function resolveOptionalText(provider: (() => string | null) | undefined): string | null {
  if (!provider) {
    return null;
  }
  try {
    return parseOptionalText(provider());
  } catch {
    return null;
  }
}

function normalizeBrowserError(
  reason: BrowserErrorReason,
  defaultMessage: string,
): NormalizedBrowserError {
  const parsedError = z.instanceof(Error).safeParse(reason);
  if (parsedError.success) {
    return {
      message: parseOptionalText(parsedError.data.message) ?? defaultMessage,
      name: parseOptionalText(parsedError.data.name),
      stack: parseOptionalText(parsedError.data.stack),
    };
  }

  const parsedErrorObject = ErrorObjectSchema.safeParse(reason);
  if (parsedErrorObject.success) {
    return {
      message: parsedErrorObject.data.message ?? defaultMessage,
      name: parsedErrorObject.data.name ?? null,
      stack: parsedErrorObject.data.stack ?? null,
    };
  }

  const parsedString = NonEmptyStringSchema.safeParse(reason);
  if (parsedString.success) {
    return {
      message: parsedString.data,
      name: null,
      stack: null,
    };
  }

  const parsedNonSymbolPrimitive = NonSymbolPrimitiveReasonSchema.safeParse(reason);
  if (parsedNonSymbolPrimitive.success) {
    return {
      message: String(parsedNonSymbolPrimitive.data),
      name: null,
      stack: null,
    };
  }

  const parsedSymbol = SymbolReasonSchema.safeParse(reason);
  if (parsedSymbol.success) {
    return {
      message: parsedSymbol.data.toString(),
      name: null,
      stack: null,
    };
  }

  return {
    message: defaultMessage,
    name: null,
    stack: null,
  };
}

function buildWindowErrorDetails(event: ErrorEvent): ClientErrorReportInput["details"] {
  return {
    eventType: WINDOW_ERROR_OPERATION,
    fileName: parseOptionalText(event.filename),
    line: event.lineno,
    column: event.colno,
  };
}

function buildUnhandledRejectionDetails(): ClientErrorReportInput["details"] {
  return {
    eventType: WINDOW_UNHANDLED_REJECTION_OPERATION,
  };
}

function reportGlobalBrowserError(
  options: GlobalClientCrashReporterOptions,
  input: {
    operation: string;
    message: string;
    name: string | null;
    stack: string | null;
    details: ClientErrorReportInput["details"];
  },
): void {
  const source = NonEmptyStringSchema.parse(options.source);
  const threadId = resolveOptionalText(options.readThreadId);
  const url =
    resolveOptionalText(options.readUrl) ??
    parseOptionalText(window.location.pathname + window.location.search);
  void reportClientError({
    source,
    operation: input.operation,
    message: input.message,
    severity: "error",
    name: input.name,
    stack: input.stack,
    requestId: null,
    threadId,
    url,
    details: input.details,
    occurredAt: new Date().toISOString(),
  }).catch(() => {
    return;
  });
}

export function installGlobalClientCrashReporter(
  options: GlobalClientCrashReporterOptions,
): GlobalClientCrashReporterHandle {
  const onWindowError = (event: ErrorEvent): void => {
    const normalized = normalizeBrowserError(
      event.error,
      parseOptionalText(event.message) ?? UNHANDLED_BROWSER_ERROR_MESSAGE,
    );

    reportGlobalBrowserError(options, {
      operation: WINDOW_ERROR_OPERATION,
      message: normalized.message,
      name: normalized.name,
      stack: normalized.stack,
      details: buildWindowErrorDetails(event),
    });
  };

  const onUnhandledRejection = (event: PromiseRejectionEvent): void => {
    const normalized = normalizeBrowserError(event.reason, UNHANDLED_PROMISE_REJECTION_MESSAGE);
    reportGlobalBrowserError(options, {
      operation: WINDOW_UNHANDLED_REJECTION_OPERATION,
      message: normalized.message,
      name: normalized.name,
      stack: normalized.stack,
      details: buildUnhandledRejectionDetails(),
    });
  };

  window.addEventListener("error", onWindowError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);

  return {
    remove: () => {
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    },
  };
}

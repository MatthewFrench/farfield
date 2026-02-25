import { z } from "zod";
import {
  reportClientError,
  type ClientErrorReportInput
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
    stack: z.string().trim().min(1).optional()
  })
  .passthrough();

function parseOptionalText(value: string | null | undefined): string | null {
  const parsed = OptionalNonEmptyStringSchema.safeParse(value ?? null);
  return parsed.success ? parsed.data ?? null : null;
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
  defaultMessage: string
): NormalizedBrowserError {
  const parsedError = z.instanceof(Error).safeParse(reason);
  if (parsedError.success) {
    return {
      message: parseOptionalText(parsedError.data.message) ?? defaultMessage,
      name: parseOptionalText(parsedError.data.name),
      stack: parseOptionalText(parsedError.data.stack)
    };
  }

  const parsedErrorObject = ErrorObjectSchema.safeParse(reason);
  if (parsedErrorObject.success) {
    return {
      message: parsedErrorObject.data.message ?? defaultMessage,
      name: parsedErrorObject.data.name ?? null,
      stack: parsedErrorObject.data.stack ?? null
    };
  }

  const parsedString = NonEmptyStringSchema.safeParse(reason);
  if (parsedString.success) {
    return {
      message: parsedString.data,
      name: null,
      stack: null
    };
  }

  const parsedNumber = z.number().safeParse(reason);
  if (parsedNumber.success) {
    return {
      message: String(parsedNumber.data),
      name: null,
      stack: null
    };
  }

  const parsedBoolean = z.boolean().safeParse(reason);
  if (parsedBoolean.success) {
    return {
      message: String(parsedBoolean.data),
      name: null,
      stack: null
    };
  }

  const parsedBigInt = z.bigint().safeParse(reason);
  if (parsedBigInt.success) {
    return {
      message: String(parsedBigInt.data),
      name: null,
      stack: null
    };
  }

  const parsedSymbol = z.symbol().safeParse(reason);
  if (parsedSymbol.success) {
    return {
      message: parsedSymbol.data.toString(),
      name: null,
      stack: null
    };
  }

  return {
    message: defaultMessage,
    name: null,
    stack: null
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
  }
): void {
  const source = NonEmptyStringSchema.parse(options.source);
  const threadId = resolveOptionalText(options.readThreadId);
  const url = resolveOptionalText(options.readUrl)
    ?? parseOptionalText(window.location.pathname + window.location.search);
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
    occurredAt: new Date().toISOString()
  }).catch(() => {});
}

export function installGlobalClientCrashReporter(
  options: GlobalClientCrashReporterOptions
): GlobalClientCrashReporterHandle {
  const onWindowError = (event: ErrorEvent): void => {
    const normalized = normalizeBrowserError(
      event.error,
      parseOptionalText(event.message) ?? "Unhandled browser error"
    );

    const details: ClientErrorReportInput["details"] = {
      eventType: "window-error",
      fileName: parseOptionalText(event.filename),
      line: event.lineno,
      column: event.colno
    };

    reportGlobalBrowserError(options, {
      operation: "window-error",
      message: normalized.message,
      name: normalized.name,
      stack: normalized.stack,
      details
    });
  };

  const onUnhandledRejection = (event: PromiseRejectionEvent): void => {
    const normalized = normalizeBrowserError(event.reason, "Unhandled promise rejection");
    const details: ClientErrorReportInput["details"] = {
      eventType: "window-unhandledrejection"
    };
    reportGlobalBrowserError(options, {
      operation: "window-unhandledrejection",
      message: normalized.message,
      name: normalized.name,
      stack: normalized.stack,
      details
    });
  };

  window.addEventListener("error", onWindowError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);

  return {
    remove: () => {
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    }
  };
}

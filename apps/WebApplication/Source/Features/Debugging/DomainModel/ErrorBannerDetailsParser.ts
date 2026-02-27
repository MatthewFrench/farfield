import { z } from "zod";
import { type ErrorBannerDetails } from "@/Features/Debugging/DomainModel/DebugIssueContracts";

const ERROR_BANNER_EMPTY_DETAILS: ErrorBannerDetails = {
  operation: "",
  message: "",
  actionId: null,
  requestId: null,
  errorId: null,
};

const ERROR_BANNER_OPERATION_PATTERN = /^[a-z][a-z0-9._-]{1,64}$/i;
const ERROR_BANNER_IDENTIFIER_PATTERN = /^[a-z0-9._-]+$/i;
const ERROR_BANNER_OPERATION_CAPTURE_PATTERN = /^([a-z][a-z0-9._-]{1,64}):\s*(.+)$/i;
const ERROR_BANNER_ACTION_IDENTIFIER_CAPTURE_PATTERN =
  /\baction(?:\s*id|Id)\b[ =:]+([a-z0-9._-]+)/i;
const ERROR_BANNER_REQUEST_IDENTIFIER_CAPTURE_PATTERN =
  /\brequest(?:\s*id|Id)\b[ =:]+([a-z0-9._-]+)/i;
const ERROR_BANNER_ERROR_IDENTIFIER_CAPTURE_PATTERN = /\berror(?:\s*id|Id)\b[ =:]+([a-z0-9._-]+)/i;
const REGULAR_EXPRESSION_FIRST_CAPTURE_GROUP_INDEX = 1;
const OPERATION_PREFIX_STRIP_MAX_PASSES = 3;

const ErrorBannerOperationSchema = z
  .string()
  .trim()
  .min(2)
  .max(65)
  .regex(ERROR_BANNER_OPERATION_PATTERN);
const ErrorBannerIdentifierSchema = z.string().trim().min(1).regex(ERROR_BANNER_IDENTIFIER_PATTERN);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripRepeatedOperationPrefix(message: string, operation: string): string {
  const normalizedMessage = message.trim();
  const normalizedOperation = operation.trim();
  if (normalizedMessage.length === 0 || normalizedOperation.length === 0) {
    return normalizedMessage;
  }

  const operationPattern = new RegExp(`^${escapeRegExp(normalizedOperation)}\\s*[:\\-]\\s*`, "i");
  let nextMessage = normalizedMessage;
  for (let index = 0; index < OPERATION_PREFIX_STRIP_MAX_PASSES; index += 1) {
    if (!operationPattern.test(nextMessage)) {
      break;
    }
    nextMessage = nextMessage.replace(operationPattern, "").trim();
  }
  return nextMessage.length > 0 ? nextMessage : normalizedMessage;
}

function readCapturedIdentifier(raw: string, pattern: RegExp): string | null {
  const identifierMatch = raw.match(pattern);
  const capturedIdentifier = identifierMatch?.[REGULAR_EXPRESSION_FIRST_CAPTURE_GROUP_INDEX];
  if (capturedIdentifier === undefined || capturedIdentifier.length === 0) {
    return null;
  }

  return ErrorBannerIdentifierSchema.parse(capturedIdentifier);
}

export function toErrorBannerDetails(rawError: string): ErrorBannerDetails {
  const raw = rawError.trim();
  if (raw.length === 0) {
    return ERROR_BANNER_EMPTY_DETAILS;
  }

  const operationMatch = raw.match(ERROR_BANNER_OPERATION_CAPTURE_PATTERN);
  const operation = operationMatch
    ? ErrorBannerOperationSchema.parse(operationMatch[REGULAR_EXPRESSION_FIRST_CAPTURE_GROUP_INDEX])
    : "";
  const messageBody = operationMatch?.[2] ?? raw;
  const message = stripRepeatedOperationPrefix(messageBody, operation);

  return {
    operation,
    message,
    actionId: readCapturedIdentifier(raw, ERROR_BANNER_ACTION_IDENTIFIER_CAPTURE_PATTERN),
    requestId: readCapturedIdentifier(raw, ERROR_BANNER_REQUEST_IDENTIFIER_CAPTURE_PATTERN),
    errorId: readCapturedIdentifier(raw, ERROR_BANNER_ERROR_IDENTIFIER_CAPTURE_PATTERN),
  };
}

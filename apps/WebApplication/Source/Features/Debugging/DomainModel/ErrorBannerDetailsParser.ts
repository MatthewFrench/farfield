import { type ErrorBannerDetails } from "@/Features/Debugging/DomainModel/DebugIssueContracts";

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
  for (let index = 0; index < 3; index += 1) {
    if (!operationPattern.test(nextMessage)) {
      break;
    }
    nextMessage = nextMessage.replace(operationPattern, "").trim();
  }
  return nextMessage.length > 0 ? nextMessage : normalizedMessage;
}

export function toErrorBannerDetails(rawError: string): ErrorBannerDetails {
  const raw = rawError.trim();
  if (raw.length === 0) {
    return {
      operation: "",
      message: "",
      actionId: null,
      requestId: null,
      errorId: null
    };
  }

  const operationMatch = raw.match(/^([a-z][a-z0-9._-]{1,64}):\s*(.+)$/i);
  const operation = operationMatch?.[1] ?? "";
  const messageBody = operationMatch?.[2] ?? raw;
  const message = stripRepeatedOperationPrefix(messageBody, operation);

  const actionIdMatch = raw.match(/\baction(?:Id)?[ =:]+([a-z0-9._-]+)/i);
  const requestIdMatch = raw.match(/\brequest(?:Id)?[ =:]+([a-z0-9._-]+)/i);
  const errorIdMatch = raw.match(/\berror(?:Id)?[ =:]+([a-z0-9._-]+)/i);

  return {
    operation,
    message,
    actionId: actionIdMatch?.[1] ?? null,
    requestId: requestIdMatch?.[1] ?? null,
    errorId: errorIdMatch?.[1] ?? null
  };
}

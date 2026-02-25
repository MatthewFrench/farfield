const OPERATION_PREFIX_PATTERN = /^([a-z][a-z0-9._-]{1,64}):\s*(.+)$/i;
const ACTION_IDENTIFIER_PATTERN = /\baction(?:Id)?[ =:]+([a-z0-9._-]+)/i;
const DEFAULT_RUNTIME_ERROR_MESSAGE = "Unknown runtime request failure";

export interface RuntimeRequestErrorDescriptorInput {
  rawMessage: string;
  defaultOperation: string;
  actionId: string;
}

export interface RuntimeRequestErrorDescriptor {
  operation: string;
  trackingErrorMessage: string;
  bannerErrorMessage: string;
}

function normalizeMessage(rawMessage: string): string {
  const normalized = rawMessage.trim();
  if (normalized.length > 0) {
    return normalized;
  }
  return DEFAULT_RUNTIME_ERROR_MESSAGE;
}

function readOperationFromMessage(message: string): string | null {
  const match = message.match(OPERATION_PREFIX_PATTERN);
  const operation = match?.[1]?.trim() ?? "";
  if (operation.length === 0) {
    return null;
  }
  return operation;
}

function appendActionIdentifier(message: string, actionId: string): string {
  if (ACTION_IDENTIFIER_PATTERN.test(message)) {
    return message;
  }
  return `${message} actionId=${actionId}`;
}

export function resolveRuntimeRequestErrorDescriptor(
  input: RuntimeRequestErrorDescriptorInput
): RuntimeRequestErrorDescriptor {
  const trackingErrorMessage = normalizeMessage(input.rawMessage);
  const parsedOperation = readOperationFromMessage(trackingErrorMessage);
  const operation = parsedOperation ?? input.defaultOperation;
  const operationScopedMessage = parsedOperation
    ? trackingErrorMessage
    : `${operation}: ${trackingErrorMessage}`;

  return {
    operation,
    trackingErrorMessage,
    bannerErrorMessage: appendActionIdentifier(operationScopedMessage, input.actionId)
  };
}

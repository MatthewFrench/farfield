/**
 * Normalizes runtime request failures into stable operation-scoped and banner-safe messages.
 * Ownership note: this module controls action-id enrichment so callers do not duplicate suffix logic.
 */
import { z } from "zod";
import {
  ACTION_ID_LABEL,
  ActionIdentifierInMessagePattern,
  RequestMetadataTokenSchema
} from "@/Shared/Contracts/RequestMetadataContracts";

const OPERATION_PREFIX_PATTERN = /^([a-z][a-z0-9._-]{1,64}):\s*(.+)$/i;
const DEFAULT_RUNTIME_ERROR_MESSAGE = "Unknown runtime request failure";
const OPERATION_DELIMITER = ": ";

const RuntimeRequestOperationSchema = z
  .string()
  .trim()
  .regex(
    /^[a-z][a-z0-9._-]{1,64}$/i,
    "Runtime request operation must start with a letter and include only letters, numbers, periods, underscores, and hyphens."
  );

const RuntimeRequestErrorDescriptorInputSchema = z
  .object({
    rawMessage: z.string(),
    defaultOperation: RuntimeRequestOperationSchema,
    actionId: RequestMetadataTokenSchema.optional()
  })
  .strict();

export interface RuntimeRequestErrorDescriptorInput {
  rawMessage: string;
  defaultOperation: string;
  actionId?: string;
}

export interface RuntimeRequestErrorDescriptor {
  operation: string;
  trackingErrorMessage: string;
  bannerErrorMessage: string;
}

function readNonEmptyTrimmedValue(value: string): string | null {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeMessage(rawMessage: string): string {
  return readNonEmptyTrimmedValue(rawMessage) ?? DEFAULT_RUNTIME_ERROR_MESSAGE;
}

function readOperationFromMessage(message: string): string | null {
  const match = message.match(OPERATION_PREFIX_PATTERN);
  const operation = match?.[1]?.trim() ?? "";
  if (operation.length === 0) {
    return null;
  }
  return operation;
}

function appendActionIdentifier(message: string, actionId: string | undefined): string {
  if (actionId === undefined || ActionIdentifierInMessagePattern.test(message)) {
    return message;
  }
  return `${message} ${ACTION_ID_LABEL}=${actionId}`;
}

function buildOperationScopedMessage(
  operation: string,
  trackingErrorMessage: string,
  parsedOperation: string | null
): string {
  if (parsedOperation !== null && parsedOperation.length > 0) {
    return trackingErrorMessage;
  }
  return `${operation}${OPERATION_DELIMITER}${trackingErrorMessage}`;
}

export function resolveRuntimeRequestErrorDescriptor(
  input: RuntimeRequestErrorDescriptorInput
): RuntimeRequestErrorDescriptor {
  const parsedInput = RuntimeRequestErrorDescriptorInputSchema.parse(input);
  const trackingErrorMessage = normalizeMessage(parsedInput.rawMessage);
  const parsedOperation = readOperationFromMessage(trackingErrorMessage);
  const operation = parsedOperation ?? parsedInput.defaultOperation;
  const operationScopedMessage = buildOperationScopedMessage(
    operation,
    trackingErrorMessage,
    parsedOperation
  );

  return {
    operation,
    trackingErrorMessage,
    bannerErrorMessage: appendActionIdentifier(operationScopedMessage, parsedInput.actionId)
  };
}

import { z } from "zod";
import { type OpenCodeStructuredDataValue, OpenCodeStructuredDataValueSchema } from "./Schemas.js";

/**
 * Owns OpenCode monitor service ingress contracts.
 * All untrusted service inputs and optional SDK envelope data are parsed once here.
 */
export interface OpenCodeListSessionsInput {
  directory?: string;
}

export interface OpenCodeSendMessageInput {
  sessionId: string;
  text: string;
  directory?: string;
}

export interface OpenCodeCreateSessionInput {
  title?: string;
  directory?: string;
}

const OPEN_CODE_MESSAGE_TEXT_REQUIRED_ERROR = "Message text is required";
const OPEN_CODE_EMPTY_COLLECTION_VALUE: OpenCodeStructuredDataValue = [];

const OpenCodeSessionIdentifierSchema = z.string().trim().min(1);
const OpenCodeDirectorySchema = z.string().trim().min(1);

const OpenCodeListSessionsInputSchema = z
  .object({
    directory: OpenCodeDirectorySchema.optional(),
  })
  .strict();

const OpenCodeCreateSessionInputSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    directory: OpenCodeDirectorySchema.optional(),
  })
  .strict();

const OpenCodeSessionLookupInputSchema = z
  .object({
    sessionId: OpenCodeSessionIdentifierSchema,
    directory: OpenCodeDirectorySchema.optional(),
  })
  .strict();

const OpenCodeSendMessageInputSchema = z
  .object({
    sessionId: OpenCodeSessionIdentifierSchema,
    text: z.string().trim().min(1, OPEN_CODE_MESSAGE_TEXT_REQUIRED_ERROR),
    directory: OpenCodeDirectorySchema.optional(),
  })
  .strict();

export type OpenCodeListSessionsParsedInput = z.infer<typeof OpenCodeListSessionsInputSchema>;
export type OpenCodeCreateSessionParsedInput = z.infer<typeof OpenCodeCreateSessionInputSchema>;
export type OpenCodeSessionLookupInput = z.infer<typeof OpenCodeSessionLookupInputSchema>;
export type OpenCodeSendMessageParsedInput = z.infer<typeof OpenCodeSendMessageInputSchema>;

export function parseStructuredDataValue(
  value: OpenCodeStructuredDataValue | undefined,
): OpenCodeStructuredDataValue {
  return OpenCodeStructuredDataValueSchema.parse(value);
}

export function parseStructuredCollectionValue(
  value: OpenCodeStructuredDataValue | undefined,
): OpenCodeStructuredDataValue {
  // OpenCode omits `data` for empty list responses; normalize to a strict empty collection contract.
  return OpenCodeStructuredDataValueSchema.parse(value ?? OPEN_CODE_EMPTY_COLLECTION_VALUE);
}

export function parseListSessionsInput(
  input: OpenCodeListSessionsInput | undefined,
): OpenCodeListSessionsParsedInput {
  return OpenCodeListSessionsInputSchema.parse(input ?? {});
}

export function parseCreateSessionInput(
  input: OpenCodeCreateSessionInput | undefined,
): OpenCodeCreateSessionParsedInput {
  return OpenCodeCreateSessionInputSchema.parse(input ?? {});
}

export function parseSessionLookupInput(
  sessionId: string,
  directory: string | undefined,
): OpenCodeSessionLookupInput {
  return OpenCodeSessionLookupInputSchema.parse({
    sessionId,
    directory,
  });
}

export function parseSendMessageInput(
  input: OpenCodeSendMessageInput,
): OpenCodeSendMessageParsedInput {
  return OpenCodeSendMessageInputSchema.parse(input);
}

export function parseProjectDirectory(directory: string): string {
  return OpenCodeDirectorySchema.parse(directory);
}

/**
 * Owns shared request/action metadata token contracts for transport headers and diagnostic message formatting.
 */
import { z } from "zod";

const REQUEST_METADATA_TOKEN_PATTERN = /^[a-z0-9._-]+$/i;
const REQUEST_METADATA_TOKEN_MAXIMUM_LENGTH = 120;

export const REQUEST_ID_HEADER_NAME = "X-Farfield-Request-Id";
export const ACTION_ID_HEADER_NAME = "X-Farfield-Action-Id";
export const ACTION_NAME_HEADER_NAME = "X-Farfield-Action-Name";
export const REQUEST_ID_LABEL = "requestId";
export const ACTION_ID_LABEL = "actionId";

export const RequestMetadataTokenSchema = z
  .string()
  .trim()
  .min(1, "Request metadata values must not be blank.")
  .max(
    REQUEST_METADATA_TOKEN_MAXIMUM_LENGTH,
    `Request metadata values must not exceed ${String(REQUEST_METADATA_TOKEN_MAXIMUM_LENGTH)} characters.`
  )
  .regex(
    REQUEST_METADATA_TOKEN_PATTERN,
    "Request metadata values may contain only letters, numbers, periods, underscores, and hyphens."
  );

export const RequestIdentifierInMessagePattern = /\brequest(?:Id)?[ =:]+[a-z0-9._-]+\b/i;
export const ActionIdentifierInMessagePattern = /\baction(?:Id)?[ =:]+[a-z0-9._-]+\b/i;

import type {
  OpenCodeDirectoryQuery,
  OpenCodeSessionCreateRequest,
  OpenCodeSessionListRequest,
  OpenCodeSessionPromptBody,
  OpenCodeSessionPromptRequest,
  OpenCodeSessionReadRequest,
} from "./ClientContracts.js";
import type {
  OpenCodeCreateSessionParsedInput,
  OpenCodeListSessionsParsedInput,
  OpenCodeSendMessageParsedInput,
  OpenCodeSessionLookupInput,
} from "./ServiceBoundaryContracts.js";

/**
 * Owns OpenCode monitor service request construction from parsed boundary contracts.
 */
const OPEN_CODE_PROMPT_TEXT_PART_TYPE = "text";

function buildDirectoryQuery(directory: string | undefined): OpenCodeDirectoryQuery | undefined {
  if (directory === undefined) {
    return undefined;
  }

  return {
    directory,
  };
}

export function buildSessionListRequest(
  input: OpenCodeListSessionsParsedInput,
): OpenCodeSessionListRequest {
  const directoryQuery = buildDirectoryQuery(input.directory);
  if (directoryQuery === undefined) {
    return {};
  }

  return {
    query: directoryQuery,
  };
}

export function buildSessionCreateRequest(
  input: OpenCodeCreateSessionParsedInput,
): OpenCodeSessionCreateRequest {
  const body =
    input.title === undefined
      ? {}
      : {
          title: input.title,
        };
  const directoryQuery = buildDirectoryQuery(input.directory);

  if (directoryQuery === undefined) {
    return { body };
  }

  return {
    body,
    query: directoryQuery,
  };
}

export function buildSessionReadRequest(
  input: OpenCodeSessionLookupInput,
): OpenCodeSessionReadRequest {
  const directoryQuery = buildDirectoryQuery(input.directory);
  const path = { id: input.sessionId };
  if (directoryQuery === undefined) {
    return { path };
  }

  return {
    path,
    query: directoryQuery,
  };
}

function buildPromptBody(text: string): OpenCodeSessionPromptBody {
  return {
    parts: [
      {
        type: OPEN_CODE_PROMPT_TEXT_PART_TYPE,
        text,
      },
    ],
  };
}

export function buildSessionPromptRequest(
  input: OpenCodeSendMessageParsedInput,
): OpenCodeSessionPromptRequest {
  const directoryQuery = buildDirectoryQuery(input.directory);
  const path = { id: input.sessionId };
  const body = buildPromptBody(input.text);

  if (directoryQuery === undefined) {
    return {
      path,
      body,
    };
  }

  return {
    path,
    query: directoryQuery,
    body,
  };
}

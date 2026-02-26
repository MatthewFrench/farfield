import type { OpenCodeStructuredDataValue } from "./Schemas.js";

/**
 * Owns the OpenCode SDK request/response contract subset consumed by this package.
 * Service and connection owners depend on these contracts rather than ad-hoc payload shapes.
 */
export interface OpenCodeDirectoryQuery {
  directory: string;
}

export interface OpenCodeSessionPath {
  id: string;
}

export interface OpenCodeSessionListRequest {
  query?: OpenCodeDirectoryQuery;
}

export interface OpenCodeSessionReadRequest {
  path: OpenCodeSessionPath;
  query?: OpenCodeDirectoryQuery;
}

export interface OpenCodeSessionCreateBody {
  title?: string;
}

export interface OpenCodeSessionCreateRequest {
  body: OpenCodeSessionCreateBody;
  query?: OpenCodeDirectoryQuery;
}

export interface OpenCodeSessionPromptTextPart {
  type: "text";
  text: string;
}

export interface OpenCodeSessionPromptBody {
  parts: OpenCodeSessionPromptTextPart[];
}

export interface OpenCodeSessionPromptRequest {
  path: OpenCodeSessionPath;
  query?: OpenCodeDirectoryQuery;
  body: OpenCodeSessionPromptBody;
}

export interface OpenCodeApiResponseEnvelope {
  data?: OpenCodeStructuredDataValue;
}

export interface OpenCodeSessionApiClient {
  list(input?: OpenCodeSessionListRequest): Promise<OpenCodeApiResponseEnvelope>;
  create(input: OpenCodeSessionCreateRequest): Promise<OpenCodeApiResponseEnvelope>;
  get(input: OpenCodeSessionReadRequest): Promise<OpenCodeApiResponseEnvelope>;
  messages(input: OpenCodeSessionReadRequest): Promise<OpenCodeApiResponseEnvelope>;
  prompt(input: OpenCodeSessionPromptRequest): Promise<OpenCodeApiResponseEnvelope>;
  abort(input: OpenCodeSessionReadRequest): Promise<OpenCodeApiResponseEnvelope>;
  delete(input: OpenCodeSessionReadRequest): Promise<OpenCodeApiResponseEnvelope>;
}

export interface OpenCodeProjectApiClient {
  list(): Promise<OpenCodeApiResponseEnvelope>;
}

export interface OpenCodeMonitorClient {
  session: OpenCodeSessionApiClient;
  project: OpenCodeProjectApiClient;
}

export interface OpenCodeConnectionClientProvider {
  getClient(): OpenCodeMonitorClient;
}

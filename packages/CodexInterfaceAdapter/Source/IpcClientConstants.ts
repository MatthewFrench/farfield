import { z } from "zod";

/**
 * Owns DesktopIpcClient protocol constants so message contracts and lifecycle wording stay centralized.
 */
export const IPC_FRAME_BOUNDARY = {
  maxFrameSizeBytes: 256 * 1024 * 1024,
  headerSizeBytes: 4,
  headerLengthOffsetBytes: 0,
  payloadEncoding: "utf8",
} as const;

export const IPC_DEFAULTS = {
  requestTimeoutMilliseconds: 20_000,
  protocolVersion: 1,
} as const;

export const IPC_CLIENT = {
  initializingClientId: "initializing-client",
  clientType: "farfield",
} as const;

export const IPC_EVENTS = {
  frame: "frame",
  connectionState: "connection-state",
  socketConnect: "connect",
  socketData: "data",
  socketClose: "close",
  socketError: "error",
} as const;

export const IPC_FRAME_TYPES = {
  broadcast: "broadcast",
  request: "request",
  response: "response",
  clientDiscoveryRequest: "client-discovery-request",
  clientDiscoveryResponse: "client-discovery-response",
} as const;

export const IPC_RESULT_TYPES = {
  error: "error",
} as const;

export const IPC_METHODS = {
  initialize: "initialize",
} as const;

export const IPC_PROTOCOL_ERRORS = {
  noHandlerForRequest: "no-handler-for-request",
} as const;

export const IPC_ERROR_MESSAGES = {
  alreadyConnected: "IPC client is already connected",
  socketClosed: "IPC socket closed",
  socketErrorPrefix: "IPC socket error",
  clientDisconnected: "IPC client disconnected",
  socketNotConnected: "IPC socket is not connected",
  frameTooLargePrefix: "IPC frame exceeded limit",
  invalidJsonFrame: "IPC frame contained invalid JSON",
  schemaValidationFailurePrefix: "IPC frame schema validation failed",
  requestTimeoutPrefix: "IPC request timed out",
  requestWriteFailurePrefix: "IPC request write failed for",
  initializeTimeout: "IPC initialize request timed out",
  initializeWriteFailure: "IPC initialize write failed",
} as const;

export const IPC_INITIALIZE_RESULT_SCHEMA = z
  .object({
    clientId: z.string().min(1),
  })
  .passthrough();

/**
 * Owns transport field-name literals for OpenCode event payload parsing.
 * Mapper schemas consume these values to keep boundary contracts centralized.
 */
export const OpenCodeEventMapperFieldNames = {
  sessionIdentifier: "sessionID",
  identifier: "id",
  statusType: "type",
  info: "info",
  part: "part",
  delta: "delta",
  status: "status",
} as const;

/**
 * Shared constants for app-server transport owners.
 * Centralized literals keep cross-module spawn, request, and parse behavior deterministic.
 */
export const APP_SERVER_COMMAND = "app-server";
export const APP_SERVER_PROCESS_NAME = APP_SERVER_COMMAND;
export const APP_SERVER_CLIENT_NAME = "farfield";
export const APP_SERVER_CLIENT_VERSION = "0.2.0";
export const APP_SERVER_INITIALIZE_METHOD = "initialize";
export const APP_SERVER_INITIALIZED_NOTIFICATION_METHOD = "initialized";
export const APP_SERVER_JSON_RPC_VERSION = "2.0";
export const DEFAULT_APP_SERVER_NOTIFICATION_EVENT_LIMIT = 200;
export const DEFAULT_APP_SERVER_NOTIFICATION_RETENTION_MAXIMUM_BYTES = 4_194_304;
export const DEFAULT_APP_SERVER_MAXIMUM_INCOMING_LINE_CHARACTERS = 1_048_576;
export const DEFAULT_APP_SERVER_REQUEST_TIMEOUT_MS = 30_000;
export const APP_SERVER_STANDARD_INPUT_LINE_TERMINATOR = "\n";
export const APP_SERVER_CODEX_USER_AGENT_ENVIRONMENT_KEY = "CODEX_USER_AGENT";
export const APP_SERVER_CODEX_CLIENT_IDENTIFIER_ENVIRONMENT_KEY = "CODEX_CLIENT_ID";

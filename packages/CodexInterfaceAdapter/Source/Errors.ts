import type { JsonValue } from "@farfield/protocol";

/**
 * Owns exported error contracts for the Codex adapter package.
 * `category` is a stable discriminant for policy/observability decisions across package boundaries.
 */
export type CodexInterfaceAdapterErrorCategory =
  | "app-server"
  | "app-server-transport"
  | "app-server-rpc"
  | "desktop-ipc";

const APP_SERVER_ERROR_NAME = "AppServerError";
const APP_SERVER_TRANSPORT_ERROR_NAME = "AppServerTransportError";
const APP_SERVER_RPC_ERROR_NAME = "AppServerRpcError";
const DESKTOP_IPC_ERROR_NAME = "DesktopIpcError";

export class AppServerError extends Error {
  public readonly category: CodexInterfaceAdapterErrorCategory = "app-server";

  public constructor(message: string) {
    super(message);
    this.name = APP_SERVER_ERROR_NAME;
  }
}

export class AppServerTransportError extends AppServerError {
  public override readonly category = "app-server-transport" as const;

  public constructor(message: string) {
    super(message);
    this.name = APP_SERVER_TRANSPORT_ERROR_NAME;
  }
}

export class AppServerRpcError extends AppServerError {
  public override readonly category = "app-server-rpc" as const;
  public readonly code: number;
  public readonly data: JsonValue | undefined;

  public constructor(code: number, message: string, data?: JsonValue) {
    super(`app-server error ${code}: ${message}`);
    this.name = APP_SERVER_RPC_ERROR_NAME;
    this.code = code;
    this.data = data;
  }
}

export class DesktopIpcError extends Error {
  public readonly category = "desktop-ipc" as const;

  public constructor(message: string) {
    super(message);
    this.name = DESKTOP_IPC_ERROR_NAME;
  }
}

export type CodexInterfaceAdapterError = AppServerError | DesktopIpcError;

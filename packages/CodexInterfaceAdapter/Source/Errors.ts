import { type JsonValue, JsonValueSchema } from "@farfield/protocol";
import { z } from "zod";

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
const NON_EMPTY_ERROR_MESSAGE_VALIDATION_ERROR = "Error message must be a non-empty string";
const APP_SERVER_RPC_CODE_VALIDATION_ERROR = "RPC error code must be an integer";

const ErrorMessageSchema = z.string().min(1, NON_EMPTY_ERROR_MESSAGE_VALIDATION_ERROR);
const AppServerRpcErrorConstructorSchema = z
  .object({
    code: z.number().int(APP_SERVER_RPC_CODE_VALIDATION_ERROR),
    message: ErrorMessageSchema,
    data: JsonValueSchema.optional(),
  })
  .strict();

type AppServerRpcErrorConstructorArguments = {
  code: number;
  message: string;
  data: JsonValue | undefined;
};

function buildConstructorContractError(errorName: string, issues: readonly z.ZodIssue[]): Error {
  const details = issues.map((issue) => issue.message).join("; ");
  return new Error(`${errorName} constructor argument mismatch: ${details}`);
}

function parseErrorMessageOrThrow(message: string, errorName: string): string {
  const parsed = ErrorMessageSchema.safeParse(message);
  if (!parsed.success) {
    throw buildConstructorContractError(errorName, parsed.error.issues);
  }

  return parsed.data;
}

function parseAppServerRpcErrorConstructorArgumentsOrThrow(
  code: number,
  message: string,
  data: JsonValue | undefined,
): AppServerRpcErrorConstructorArguments {
  const parsed = AppServerRpcErrorConstructorSchema.safeParse({
    code,
    message,
    data,
  });
  if (!parsed.success) {
    throw buildConstructorContractError(APP_SERVER_RPC_ERROR_NAME, parsed.error.issues);
  }

  return {
    code: parsed.data.code,
    message: parsed.data.message,
    data: parsed.data.data,
  };
}

export class AppServerError extends Error {
  public readonly category: CodexInterfaceAdapterErrorCategory = "app-server";

  public constructor(message: string) {
    super(parseErrorMessageOrThrow(message, APP_SERVER_ERROR_NAME));
    this.name = APP_SERVER_ERROR_NAME;
  }
}

export class AppServerTransportError extends AppServerError {
  public override readonly category: CodexInterfaceAdapterErrorCategory = "app-server-transport";

  public constructor(message: string) {
    super(message);
    this.name = APP_SERVER_TRANSPORT_ERROR_NAME;
  }
}

export class AppServerRpcError extends AppServerError {
  public override readonly category: CodexInterfaceAdapterErrorCategory = "app-server-rpc";
  public readonly code: number;
  public readonly data: JsonValue | undefined;

  public constructor(code: number, message: string, data?: JsonValue) {
    const parsed = parseAppServerRpcErrorConstructorArgumentsOrThrow(code, message, data);
    super(`app-server error ${parsed.code}: ${parsed.message}`);
    this.name = APP_SERVER_RPC_ERROR_NAME;
    this.code = parsed.code;
    this.data = parsed.data;
  }
}

export class DesktopIpcError extends Error {
  public readonly category: CodexInterfaceAdapterErrorCategory = "desktop-ipc";

  public constructor(message: string) {
    super(parseErrorMessageOrThrow(message, DESKTOP_IPC_ERROR_NAME));
    this.name = DESKTOP_IPC_ERROR_NAME;
  }
}

export type CodexInterfaceAdapterError = AppServerError | DesktopIpcError;

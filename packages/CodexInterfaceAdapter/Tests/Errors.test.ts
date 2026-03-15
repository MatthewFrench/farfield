import type { JsonValue } from "@farfield/protocol";
import { describe, expect, it } from "vitest";
import {
  AppServerError,
  AppServerRpcError,
  AppServerTransportError,
  DesktopIpcError,
} from "../Source/Errors.js";

describe("Errors", () => {
  it("assigns stable category and class hierarchy for app-server transport errors", () => {
    const error = new AppServerTransportError("transport failed");

    expect(error).toBeInstanceOf(AppServerTransportError);
    expect(error).toBeInstanceOf(AppServerError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("AppServerTransportError");
    expect(error.category).toBe("app-server-transport");
    expect(error.message).toBe("transport failed");
  });

  it("keeps rpc error metadata and category as strict fields", () => {
    const payload: JsonValue = {
      requestId: "request-1",
    };
    const error = new AppServerRpcError(-32_600, "conversation not found", payload);

    expect(error).toBeInstanceOf(AppServerRpcError);
    expect(error).toBeInstanceOf(AppServerError);
    expect(error.name).toBe("AppServerRpcError");
    expect(error.category).toBe("app-server-rpc");
    expect(error.code).toBe(-32_600);
    expect(error.data).toEqual(payload);
    expect(error.message).toBe("app-server error -32600: conversation not found");
  });

  it("keeps rpc error data as explicit undefined when omitted", () => {
    const error = new AppServerRpcError(-32_003, "server overloaded");

    expect(error.code).toBe(-32_003);
    expect(error.data).toBeUndefined();
    expect(error.message).toBe("app-server error -32003: server overloaded");
  });

  it("exposes desktop ipc errors with explicit category", () => {
    const error = new DesktopIpcError("socket closed");

    expect(error).toBeInstanceOf(DesktopIpcError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("DesktopIpcError");
    expect(error.category).toBe("desktop-ipc");
    expect(error.message).toBe("socket closed");
  });

  it("rejects empty app-server error messages", () => {
    expect(() => new AppServerError("")).toThrowError(
      "AppServerError constructor argument mismatch: Error message must be a non-empty string",
    );
  });

  it("rejects rpc constructor code that is not an integer", () => {
    expect(() => new AppServerRpcError(-32_600.5, "invalid request")).toThrowError(
      "AppServerRpcError constructor argument mismatch: RPC error code must be an integer",
    );
  });

  it("rejects rpc constructor messages that are empty", () => {
    expect(() => new AppServerRpcError(-32_600, "")).toThrowError(
      "AppServerRpcError constructor argument mismatch: Error message must be a non-empty string",
    );
  });

  it("rejects empty desktop ipc messages", () => {
    expect(() => new DesktopIpcError("")).toThrowError(
      "DesktopIpcError constructor argument mismatch: Error message must be a non-empty string",
    );
  });
});

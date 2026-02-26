import { describe, expect, it } from "vitest";
import {
  extractRequestIdFromErrorMessage,
  formatTrackedUiErrorMessage,
  shouldIgnoreUiErrorMessage
} from "../Source/Features/Debugging/StateManagement/TrackedUserInterfaceErrorPolicy";

describe("TrackedUserInterfaceErrorPolicy", () => {
  it("extracts request identifiers from supported message styles", () => {
    expect(extractRequestIdFromErrorMessage("requestId=req-77 failed")).toBe("req-77");
    expect(extractRequestIdFromErrorMessage("Request id: req-88 timed out")).toBe("req-88");
    expect(extractRequestIdFromErrorMessage("request id req-99")).toBe("req-99");
    expect(extractRequestIdFromErrorMessage("REQUESTID=REQ.100_ABC failed")).toBe("REQ.100_ABC");
    expect(extractRequestIdFromErrorMessage("request id:req-101 failed")).toBe("req-101");
    expect(extractRequestIdFromErrorMessage("request id = req-102 failed")).toBe("req-102");
  });

  it("returns null when request identifier patterns are not valid", () => {
    expect(extractRequestIdFromErrorMessage("Request failed for /api/threads status=500")).toBeNull();
    expect(extractRequestIdFromErrorMessage("request id: ")).toBeNull();
    expect(extractRequestIdFromErrorMessage("request identifier: req-200")).toBeNull();
    expect(extractRequestIdFromErrorMessage("request-id=req-300")).toBeNull();
  });

  it("ignores known cancellation and shutdown messages", () => {
    expect(shouldIgnoreUiErrorMessage("   Request canceled for thread thread-1   ")).toBe(true);
    expect(shouldIgnoreUiErrorMessage("Server is shutting down while processing")).toBe(true);
    expect(shouldIgnoreUiErrorMessage("Request failed for /api/threads/thread-1")).toBe(false);
  });

  it("formats tracked error text with optional tags", () => {
    expect(formatTrackedUiErrorMessage({
      operation: "send-message",
      errorMessage: "Failed to send",
      actionId: "action-1",
      requestId: "req-1",
      errorId: "error-1"
    })).toBe("send-message: Failed to send actionId=action-1 requestId=req-1 errorId=error-1");

    expect(formatTrackedUiErrorMessage({
      operation: "send-message",
      errorMessage: "Failed to send",
      actionId: "action-2",
      requestId: null,
      errorId: null
    })).toBe("send-message: Failed to send actionId=action-2");
  });
});

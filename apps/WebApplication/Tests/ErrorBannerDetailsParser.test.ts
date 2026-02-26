import { describe, expect, it } from "vitest";
import { toErrorBannerDetails } from "@/Features/Debugging/DomainModel/ErrorBannerDetailsParser";

describe("ErrorBannerDetailsParser", () => {
  it("returns empty details for blank input", () => {
    expect(toErrorBannerDetails("   ")).toEqual({
      operation: "",
      message: "",
      actionId: null,
      requestId: null,
      errorId: null
    });
  });

  it("extracts operation, message, and identifiers", () => {
    const details = toErrorBannerDetails(
      "send-message: failed to send actionId=action-7 requestId=req-7 errorId=error-7"
    );

    expect(details).toEqual({
      operation: "send-message",
      message: "failed to send actionId=action-7 requestId=req-7 errorId=error-7",
      actionId: "action-7",
      requestId: "req-7",
      errorId: "error-7"
    });
  });

  it("strips repeated operation prefixes from the banner message", () => {
    const details = toErrorBannerDetails(
      "thread.read: thread.read: thread.read - Request failed requestId=req-9"
    );

    expect(details.operation).toBe("thread.read");
    expect(details.message).toBe("Request failed requestId=req-9");
    expect(details.requestId).toBe("req-9");
  });

  it("keeps the raw message when no operation prefix is present", () => {
    const details = toErrorBannerDetails("Request failed requestId=req-11");

    expect(details.operation).toBe("");
    expect(details.message).toBe("Request failed requestId=req-11");
    expect(details.requestId).toBe("req-11");
  });
});

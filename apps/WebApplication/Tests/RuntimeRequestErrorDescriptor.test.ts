import {
  describe,
  expect,
  it
} from "vitest";
import {
  resolveRuntimeRequestErrorDescriptor
} from "../Source/Shared/Errors/RuntimeRequestErrorDescriptor";

describe("resolveRuntimeRequestErrorDescriptor", () => {
  it("preserves a prefixed operation for banner and tracking output", () => {
    const descriptor = resolveRuntimeRequestErrorDescriptor({
      rawMessage: "core.load: forced refresh failure",
      defaultOperation: "runtime-request-error",
      actionId: "action_123"
    });

    expect(descriptor.operation).toBe("core.load");
    expect(descriptor.trackingErrorMessage).toBe("core.load: forced refresh failure");
    expect(descriptor.bannerErrorMessage).toBe(
      "core.load: forced refresh failure actionId=action_123"
    );
  });

  it("applies the default operation when the message has no prefix", () => {
    const descriptor = resolveRuntimeRequestErrorDescriptor({
      rawMessage: "Request failed for /api/threads",
      defaultOperation: "runtime-request-error",
      actionId: "action_234"
    });

    expect(descriptor.operation).toBe("runtime-request-error");
    expect(descriptor.trackingErrorMessage).toBe("Request failed for /api/threads");
    expect(descriptor.bannerErrorMessage).toBe(
      "runtime-request-error: Request failed for /api/threads actionId=action_234"
    );
  });

  it("keeps an existing action identifier without appending a duplicate", () => {
    const descriptor = resolveRuntimeRequestErrorDescriptor({
      rawMessage: "core.load: request failed actionId=action_existing",
      defaultOperation: "runtime-request-error",
      actionId: "action_345"
    });

    expect(descriptor.operation).toBe("core.load");
    expect(descriptor.bannerErrorMessage).toBe("core.load: request failed actionId=action_existing");
  });
});

import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolvePushStatePath } from "../Source/PushStatePath.js";

describe("resolvePushStatePath", () => {
  it("uses OS state directory on macOS when env override is not set", () => {
    const resolved = resolvePushStatePath({
      envPath: undefined,
      appDataPath: undefined,
      xdgStateHome: undefined,
      homeDirectory: "/Users/test-user",
      platform: "darwin"
    });

    expect(resolved.source).toBe("default");
    expect(resolved.filePath).toBe(
      path.resolve("/Users/test-user/Library/Application Support/farfield/push-state.json")
    );
  });

  it("uses PUSH_STATE_PATH when explicitly configured", () => {
    const resolved = resolvePushStatePath({
      envPath: "/tmp/custom-state/push-state.json",
      appDataPath: undefined,
      xdgStateHome: undefined,
      homeDirectory: "/Users/test-user",
      platform: "linux"
    });

    expect(resolved.source).toBe("env");
    expect(resolved.filePath).toBe(path.resolve("/tmp/custom-state/push-state.json"));
  });

  it("throws when PUSH_STATE_PATH is blank", () => {
    expect(() =>
      resolvePushStatePath({
        envPath: "   ",
        appDataPath: undefined,
        xdgStateHome: undefined,
        homeDirectory: "/Users/test-user",
        platform: "linux"
      })
    ).toThrowError(/PUSH_STATE_PATH/);
  });
});

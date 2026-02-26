import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolvePushStatePath } from "../Source/Modules/PushNotifications/PushStatePath.js";

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

  it("uses APPDATA on win32 when PUSH_STATE_PATH is not configured", () => {
    const resolved = resolvePushStatePath({
      envPath: undefined,
      appDataPath: "C:/Users/test-user/AppData/Roaming",
      xdgStateHome: undefined,
      homeDirectory: "C:/Users/test-user",
      platform: "win32"
    });

    expect(resolved.source).toBe("default");
    expect(resolved.filePath).toBe(
      path.resolve("C:/Users/test-user/AppData/Roaming/farfield/push-state.json")
    );
  });

  it("uses XDG_STATE_HOME on linux when provided", () => {
    const resolved = resolvePushStatePath({
      envPath: undefined,
      appDataPath: undefined,
      xdgStateHome: "/home/test-user/.cache/state",
      homeDirectory: "/home/test-user",
      platform: "linux"
    });

    expect(resolved.source).toBe("default");
    expect(resolved.filePath).toBe(
      path.resolve("/home/test-user/.cache/state/farfield/push-state.json")
    );
  });
});

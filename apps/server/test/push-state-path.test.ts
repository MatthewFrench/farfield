import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { migratePushStateFile, resolvePushStatePath } from "../src/push-state-path.js";

const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    if (fs.existsSync(directory)) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
});

function createTempDirectory(prefix: string): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirectories.push(directory);
  return directory;
}

describe("resolvePushStatePath", () => {
  it("uses OS state directory on macOS when env override is not set", () => {
    const resolved = resolvePushStatePath({
      envPath: undefined,
      appDataPath: undefined,
      xdgStateHome: undefined,
      homeDirectory: "/Users/test-user",
      platform: "darwin",
      moduleDirectory: "/repo/apps/server/src"
    });

    expect(resolved.source).toBe("default");
    expect(resolved.filePath).toBe(
      path.resolve("/Users/test-user/Library/Application Support/farfield/push-state.json")
    );
    expect(resolved.legacyPaths).toContain(path.resolve("/repo/apps/server/push-state.json"));
    expect(resolved.legacyPaths).toContain(path.resolve("/repo/apps/server/apps/server/push-state.json"));
  });

  it("uses PUSH_STATE_PATH when explicitly configured", () => {
    const resolved = resolvePushStatePath({
      envPath: "/tmp/custom-state/push-state.json",
      appDataPath: undefined,
      xdgStateHome: undefined,
      homeDirectory: "/Users/test-user",
      platform: "linux",
      moduleDirectory: "/repo/apps/server/src"
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
        platform: "linux",
        moduleDirectory: "/repo/apps/server/src"
      })
    ).toThrowError(/PUSH_STATE_PATH/);
  });
});

describe("migratePushStateFile", () => {
  it("moves legacy state into the default state path", () => {
    const workspaceRoot = createTempDirectory("farfield-push-state-workspace-");
    const moduleDirectory = path.join(workspaceRoot, "apps", "server", "src");
    fs.mkdirSync(moduleDirectory, { recursive: true });

    const resolution = resolvePushStatePath({
      envPath: undefined,
      appDataPath: undefined,
      xdgStateHome: path.join(workspaceRoot, "state-home"),
      homeDirectory: path.join(workspaceRoot, "home"),
      platform: "linux",
      moduleDirectory
    });

    const legacyPath = path.join(workspaceRoot, "apps", "server", "apps", "server", "push-state.json");
    fs.mkdirSync(path.dirname(legacyPath), { recursive: true });
    fs.writeFileSync(
      legacyPath,
      JSON.stringify(
        {
          version: 1,
          subscriptions: [],
          completionWatermarks: []
        },
        null,
        2
      ),
      "utf8"
    );

    const result = migratePushStateFile(resolution);

    expect(result.migrated).toBe(true);
    expect(result.fromPath).toBe(path.resolve(legacyPath));
    expect(result.toPath).toBe(path.resolve(resolution.filePath));
    expect(fs.existsSync(resolution.filePath)).toBe(true);
    expect(fs.existsSync(legacyPath)).toBe(false);
  });

  it("does not migrate when source path is configured via env", () => {
    const workspaceRoot = createTempDirectory("farfield-push-state-env-");
    const moduleDirectory = path.join(workspaceRoot, "apps", "server", "src");
    fs.mkdirSync(moduleDirectory, { recursive: true });

    const configuredPath = path.join(workspaceRoot, "configured", "push-state.json");
    const resolution = resolvePushStatePath({
      envPath: configuredPath,
      appDataPath: undefined,
      xdgStateHome: undefined,
      homeDirectory: path.join(workspaceRoot, "home"),
      platform: "linux",
      moduleDirectory
    });

    const legacyPath = path.join(workspaceRoot, "apps", "server", "push-state.json");
    fs.mkdirSync(path.dirname(legacyPath), { recursive: true });
    fs.writeFileSync(legacyPath, "{}", "utf8");

    const result = migratePushStateFile(resolution);

    expect(result.migrated).toBe(false);
    expect(result.fromPath).toBeNull();
    expect(fs.existsSync(legacyPath)).toBe(true);
    expect(fs.existsSync(configuredPath)).toBe(false);
  });
});

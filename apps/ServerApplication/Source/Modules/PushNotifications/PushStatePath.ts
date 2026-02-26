import path from "node:path";
import { z } from "zod";

const OptionalPathOverrideSchema = z.string().trim().min(1).optional();
const NonEmptyPathSchema = z.string().trim().min(1);
const STATE_DIRECTORY_NAME = "farfield";
const PUSH_STATE_FILE_NAME = "push-state.json";
const APPLE_SUPPORT_DIRECTORY_NAME = "Application Support";
const WINDOWS_ROAMING_DIRECTORY_PATH_SEGMENTS = ["AppData", "Roaming"] as const;
const LINUX_DEFAULT_STATE_DIRECTORY_PATH_SEGMENTS = [".local", "state"] as const;

export interface PushStatePathResolution {
  filePath: string;
  source: "env" | "default";
}

export interface ResolvePushStatePathOptions {
  envPath: string | undefined;
  appDataPath: string | undefined;
  xdgStateHome: string | undefined;
  homeDirectory: string;
  platform: NodeJS.Platform;
}

function parseOptionalPathOverride(label: string, value: string | undefined): string | null {
  const result = OptionalPathOverrideSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`${label} must be a non-empty path when set`);
  }

  const parsed = result.data;
  if (parsed === undefined) {
    return null;
  }

  return path.resolve(parsed);
}

function requirePath(label: string, value: string): string {
  const result = NonEmptyPathSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`${label} must be a non-empty path`);
  }
  return result.data;
}

function resolveDefaultStateDirectory(
  platform: NodeJS.Platform,
  homeDirectory: string,
  appDataPath: string | undefined,
  xdgStateHome: string | undefined
): string {
  if (platform === "darwin") {
    return path.join(homeDirectory, "Library", APPLE_SUPPORT_DIRECTORY_NAME, STATE_DIRECTORY_NAME);
  }

  if (platform === "win32") {
    const appData =
      parseOptionalPathOverride("APPDATA", appDataPath)
      ?? path.join(homeDirectory, ...WINDOWS_ROAMING_DIRECTORY_PATH_SEGMENTS);
    return path.join(appData, STATE_DIRECTORY_NAME);
  }

  const xdgStatePath =
    parseOptionalPathOverride("XDG_STATE_HOME", xdgStateHome)
    ?? path.join(homeDirectory, ...LINUX_DEFAULT_STATE_DIRECTORY_PATH_SEGMENTS);
  return path.join(xdgStatePath, STATE_DIRECTORY_NAME);
}

export function resolvePushStatePath(options: ResolvePushStatePathOptions): PushStatePathResolution {
  const configuredPath = parseOptionalPathOverride("PUSH_STATE_PATH", options.envPath);
  const homeDirectory = requirePath("homeDirectory", options.homeDirectory);

  const defaultStateDirectory = resolveDefaultStateDirectory(
    options.platform,
    homeDirectory,
    options.appDataPath,
    options.xdgStateHome
  );
  const defaultPath = path.join(defaultStateDirectory, PUSH_STATE_FILE_NAME);
  const filePath = configuredPath ?? defaultPath;

  return {
    filePath,
    source: configuredPath !== null ? "env" : "default"
  };
}

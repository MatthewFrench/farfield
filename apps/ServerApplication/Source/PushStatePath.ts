import path from "node:path";
import { z } from "zod";

const OptionalPathOverrideSchema = z.string().trim().min(1).optional();
const NonEmptyPathSchema = z.string().trim().min(1);

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
  if (!parsed) {
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
    return path.join(homeDirectory, "Library", "Application Support", "farfield");
  }

  if (platform === "win32") {
    const appData = parseOptionalPathOverride("APPDATA", appDataPath) ?? path.join(homeDirectory, "AppData", "Roaming");
    return path.join(appData, "farfield");
  }

  const xdgStatePath = parseOptionalPathOverride("XDG_STATE_HOME", xdgStateHome) ?? path.join(homeDirectory, ".local", "state");
  return path.join(xdgStatePath, "farfield");
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
  const defaultPath = path.join(defaultStateDirectory, "push-state.json");
  const filePath = configuredPath ?? defaultPath;

  return {
    filePath,
    source: configuredPath ? "env" : "default"
  };
}

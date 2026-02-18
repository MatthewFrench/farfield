import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const OptionalPathOverrideSchema = z.string().trim().min(1).optional();
const NonEmptyPathSchema = z.string().trim().min(1);

export interface PushStatePathResolution {
  filePath: string;
  source: "env" | "default";
  legacyPaths: string[];
}

export interface ResolvePushStatePathOptions {
  envPath: string | undefined;
  appDataPath: string | undefined;
  xdgStateHome: string | undefined;
  homeDirectory: string;
  platform: NodeJS.Platform;
  moduleDirectory: string;
}

export interface PushStateMigrationResult {
  migrated: boolean;
  fromPath: string | null;
  toPath: string;
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

function uniqueResolvedPaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const candidate of paths) {
    const resolved = path.resolve(candidate);
    if (seen.has(resolved)) {
      continue;
    }
    seen.add(resolved);
    unique.push(resolved);
  }
  return unique;
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
  const moduleDirectory = requirePath("moduleDirectory", options.moduleDirectory);

  const serverPackageRoot = path.resolve(moduleDirectory, "..");
  const repositoryRoot = path.resolve(serverPackageRoot, "..", "..");

  const defaultStateDirectory = resolveDefaultStateDirectory(
    options.platform,
    homeDirectory,
    options.appDataPath,
    options.xdgStateHome
  );
  const defaultPath = path.join(defaultStateDirectory, "push-state.json");
  const filePath = configuredPath ?? defaultPath;

  const legacyPaths = uniqueResolvedPaths([
    path.join(repositoryRoot, "apps", "server", "push-state.json"),
    path.join(serverPackageRoot, "push-state.json"),
    path.join(serverPackageRoot, "apps", "server", "push-state.json")
  ]).filter((candidate) => candidate !== filePath);

  return {
    filePath,
    source: configuredPath ? "env" : "default",
    legacyPaths
  };
}

export function migratePushStateFile(resolution: PushStatePathResolution): PushStateMigrationResult {
  const targetPath = path.resolve(resolution.filePath);
  if (resolution.source === "env") {
    return {
      migrated: false,
      fromPath: null,
      toPath: targetPath
    };
  }

  if (fs.existsSync(targetPath)) {
    return {
      migrated: false,
      fromPath: null,
      toPath: targetPath
    };
  }

  for (const legacyPath of resolution.legacyPaths) {
    if (!fs.existsSync(legacyPath)) {
      continue;
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(legacyPath, targetPath, fs.constants.COPYFILE_EXCL);
    fs.unlinkSync(legacyPath);
    return {
      migrated: true,
      fromPath: legacyPath,
      toPath: targetPath
    };
  }

  return {
    migrated: false,
    fromPath: null,
    toPath: targetPath
  };
}

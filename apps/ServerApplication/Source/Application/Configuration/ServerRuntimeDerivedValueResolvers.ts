import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ServerRuntimeDefaultValues,
  ServerRuntimeEnvironmentVariableNames,
  ServerRuntimeFormattingConstants,
  ServerRuntimeGitCommandConfiguration,
  ServerRuntimeStaticConfiguration,
} from "./ServerRuntimeConfigurationConstants.js";
import {
  readEnvironmentValue,
  readOptionalPathEnvironmentValue,
  readTrimmedEnvironmentValue,
} from "./ServerRuntimeEnvironmentValueReaders.js";

// Owner note: this module owns deterministic derivation of runtime values that
// depend on precedence rules, platform-specific paths, and process metadata.
export interface ClientErrorSessionMetadata {
  clientErrorSessionStartedAt: string;
  clientErrorSessionTimestamp: string;
  clientErrorSessionId: string;
}

export function resolveApiTokenFromEnvironment(env: NodeJS.ProcessEnv): string {
  const apiTokenValue = readEnvironmentValue(env, ServerRuntimeEnvironmentVariableNames.apiToken);
  if (apiTokenValue !== null) {
    return apiTokenValue.trim();
  }

  return readTrimmedEnvironmentValue(env, ServerRuntimeEnvironmentVariableNames.pushApiToken);
}

export function resolveWebHealthBuildIdentifierFromEnvironment(env: NodeJS.ProcessEnv): string {
  const buildIdentifierCandidate =
    readEnvironmentValue(env, ServerRuntimeEnvironmentVariableNames.webBuildId) ??
    readEnvironmentValue(env, ServerRuntimeEnvironmentVariableNames.webApplicationBuildId) ??
    ServerRuntimeDefaultValues.webHealthBuildId;
  const normalizedBuildIdentifier = buildIdentifierCandidate.trim();
  return normalizedBuildIdentifier.length > 0
    ? normalizedBuildIdentifier
    : ServerRuntimeDefaultValues.webHealthBuildId;
}

export function resolveApiSessionSigningSecret(env: NodeJS.ProcessEnv, apiToken: string): string {
  const sessionSecretCandidate =
    readEnvironmentValue(env, ServerRuntimeEnvironmentVariableNames.apiSessionSecret) ?? apiToken;
  const normalizedSessionSecret = sessionSecretCandidate.trim();
  return normalizedSessionSecret.length > 0
    ? normalizedSessionSecret
    : ServerRuntimeDefaultValues.apiSessionSigningSecret;
}

export function resolveCodexExecutablePathFromEnvironment(env: NodeJS.ProcessEnv): string {
  const configuredPath = readEnvironmentValue(
    env,
    ServerRuntimeEnvironmentVariableNames.codexCliPath,
  );
  if (configuredPath !== null && configuredPath.length > 0) {
    return configuredPath;
  }

  const desktopPath = ServerRuntimeStaticConfiguration.codexDesktopExecutablePath;
  if (fs.existsSync(desktopPath)) {
    return desktopPath;
  }

  return ServerRuntimeStaticConfiguration.codexExecutablePath;
}

export function resolveIpcSocketPathFromEnvironment(env: NodeJS.ProcessEnv): string {
  const configuredPath = readEnvironmentValue(
    env,
    ServerRuntimeEnvironmentVariableNames.codexIpcSocketPath,
  );
  if (configuredPath !== null && configuredPath.length > 0) {
    return configuredPath;
  }

  if (process.platform === "win32") {
    return ServerRuntimeStaticConfiguration.windowsCodexIpcSocketPath;
  }

  const userIdentifier = process.getuid?.() ?? 0;
  return path.join(
    os.tmpdir(),
    ServerRuntimeStaticConfiguration.codexIpcDirectoryName,
    `ipc-${String(userIdentifier)}.sock`,
  );
}

export function resolveGitCommitHash(defaultWorkspacePath: string): string | null {
  try {
    const hash = execFileSync(
      ServerRuntimeGitCommandConfiguration.command,
      ServerRuntimeGitCommandConfiguration.shortHeadArguments,
      {
        cwd: defaultWorkspacePath,
        encoding: ServerRuntimeGitCommandConfiguration.outputEncoding,
      },
    ).trim();
    return hash.length > 0 ? hash : null;
  } catch {
    return null;
  }
}

export function resolvePushLocalCaSourcePath(env: NodeJS.ProcessEnv): string {
  const configuredPath = readOptionalPathEnvironmentValue(
    env,
    ServerRuntimeEnvironmentVariableNames.pushLocalCaPath,
  );
  if (configuredPath !== null) {
    return configuredPath;
  }

  const homeDirectory = os.homedir();
  if (process.platform === "darwin") {
    return path.join(
      homeDirectory,
      "Library",
      "Application Support",
      "Caddy",
      "pki",
      "authorities",
      "local",
      "root.crt",
    );
  }

  if (process.platform === "win32") {
    const appDataDirectory =
      readOptionalPathEnvironmentValue(env, ServerRuntimeEnvironmentVariableNames.appDataPath) ??
      path.join(homeDirectory, "AppData", "Roaming");
    return path.join(appDataDirectory, "Caddy", "pki", "authorities", "local", "root.crt");
  }

  const xdgDataHome =
    readOptionalPathEnvironmentValue(env, ServerRuntimeEnvironmentVariableNames.xdgDataHome) ??
    path.join(homeDirectory, ".local", "share");
  return path.join(xdgDataHome, "caddy", "pki", "authorities", "local", "root.crt");
}

export function resolveClientErrorSessionMetadata(): ClientErrorSessionMetadata {
  const clientErrorSessionStartedAt = new Date().toISOString();
  const clientErrorSessionTimestamp = clientErrorSessionStartedAt.replace(
    ServerRuntimeFormattingConstants.clientErrorSessionTimestampUnsafeCharactersPattern,
    ServerRuntimeFormattingConstants.clientErrorSessionTimestampSeparator,
  );
  const clientErrorSessionId = `${ServerRuntimeStaticConfiguration.sessionIdentifierPrefix}${clientErrorSessionTimestamp}-${String(process.pid)}`;
  return {
    clientErrorSessionStartedAt,
    clientErrorSessionTimestamp,
    clientErrorSessionId,
  };
}

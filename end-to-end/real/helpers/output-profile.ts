import path from "node:path";

const OutputProfilePattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const OutputProfileEnvironmentVariableName = "E2E_REAL_OUTPUT_PROFILE";

function readOutputProfileOrNull(): string | null {
  const rawOutputProfile = (process.env[OutputProfileEnvironmentVariableName] ?? "").trim();
  if (rawOutputProfile.length === 0) {
    return null;
  }
  if (!OutputProfilePattern.test(rawOutputProfile)) {
    throw new Error(
      `${OutputProfileEnvironmentVariableName} must match ${OutputProfilePattern.source}`,
    );
  }
  return rawOutputProfile;
}

export function resolveRealEndToEndRuntimeOutputDirectory(directoryName: string): string {
  const outputProfile = readOutputProfileOrNull();
  const baseDirectoryPath = path.join(process.cwd(), ".runtime", directoryName);
  if (outputProfile === null) {
    return baseDirectoryPath;
  }
  return path.join(baseDirectoryPath, outputProfile);
}

export function resolveRealEndToEndPlaywrightOutputDirectory(
  rootDirectoryName: string,
  defaultLeafDirectoryName: string,
): string {
  const outputProfile = readOutputProfileOrNull();
  if (outputProfile === null) {
    return path.join(rootDirectoryName, defaultLeafDirectoryName);
  }
  return path.join(rootDirectoryName, outputProfile, defaultLeafDirectoryName);
}

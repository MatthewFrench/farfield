import { z } from "zod";
import {
  APP_SERVER_CODEX_CLIENT_IDENTIFIER_ENVIRONMENT_KEY,
  APP_SERVER_CODEX_USER_AGENT_ENVIRONMENT_KEY,
} from "./AppServerTransportConstants.js";

const SpawnEnvironmentVariableSchema = z.string().min(1).optional();

// This allowlist intentionally covers cross-platform process execution context only.
// Any key not listed here is blocked from child-process startup.
const AppServerSpawnEnvironmentShape = {
  HOME: SpawnEnvironmentVariableSchema,
  PATH: SpawnEnvironmentVariableSchema,
  Path: SpawnEnvironmentVariableSchema,
  PATHEXT: SpawnEnvironmentVariableSchema,
  SHELL: SpawnEnvironmentVariableSchema,
  USER: SpawnEnvironmentVariableSchema,
  USERNAME: SpawnEnvironmentVariableSchema,
  TMPDIR: SpawnEnvironmentVariableSchema,
  TMP: SpawnEnvironmentVariableSchema,
  TEMP: SpawnEnvironmentVariableSchema,
  LANG: SpawnEnvironmentVariableSchema,
  LC_ALL: SpawnEnvironmentVariableSchema,
  TERM: SpawnEnvironmentVariableSchema,
  TZ: SpawnEnvironmentVariableSchema,
  SSL_CERT_FILE: SpawnEnvironmentVariableSchema,
  SSL_CERT_DIR: SpawnEnvironmentVariableSchema,
  NODE_EXTRA_CA_CERTS: SpawnEnvironmentVariableSchema,
  HTTP_PROXY: SpawnEnvironmentVariableSchema,
  HTTPS_PROXY: SpawnEnvironmentVariableSchema,
  NO_PROXY: SpawnEnvironmentVariableSchema,
  ALL_PROXY: SpawnEnvironmentVariableSchema,
  CODEX_HOME: SpawnEnvironmentVariableSchema,
  XDG_CONFIG_HOME: SpawnEnvironmentVariableSchema,
  XDG_CACHE_HOME: SpawnEnvironmentVariableSchema,
  APPDATA: SpawnEnvironmentVariableSchema,
  LOCALAPPDATA: SpawnEnvironmentVariableSchema,
  USERPROFILE: SpawnEnvironmentVariableSchema,
  SystemRoot: SpawnEnvironmentVariableSchema,
  ComSpec: SpawnEnvironmentVariableSchema,
} as const;

export const ProcessEnvironmentSchema = z.record(z.string(), z.string().optional());

const AppServerSpawnInheritedEnvironmentSchema = z.object(AppServerSpawnEnvironmentShape).strip();
const AppServerSpawnOverrideEnvironmentSchema = z.object(AppServerSpawnEnvironmentShape).strict();
const BuildAppServerSpawnEnvironmentInputSchema = z
  .object({
    baseEnvironment: ProcessEnvironmentSchema,
    overrideEnvironment: ProcessEnvironmentSchema.optional(),
    userAgent: z.string().min(1),
    clientId: z.string().min(1),
  })
  .strict();

export interface BuildAppServerSpawnEnvironmentInput {
  baseEnvironment: NodeJS.ProcessEnv;
  overrideEnvironment?: NodeJS.ProcessEnv;
  userAgent: string;
  clientId: string;
}

/**
 * Owns the exact environment contract used to spawn `codex app-server`.
 * Only allowlisted keys may cross the process boundary so configuration remains explicit and reviewable.
 */
export function buildAppServerSpawnEnvironment(
  input: BuildAppServerSpawnEnvironmentInput,
): NodeJS.ProcessEnv {
  const parsedInput = BuildAppServerSpawnEnvironmentInputSchema.parse(input);
  const inheritedEnvironment = AppServerSpawnInheritedEnvironmentSchema.parse(
    parsedInput.baseEnvironment,
  );
  const overrideEnvironment = AppServerSpawnOverrideEnvironmentSchema.parse(
    parsedInput.overrideEnvironment ?? {},
  );

  return {
    ...inheritedEnvironment,
    ...overrideEnvironment,
    [APP_SERVER_CODEX_USER_AGENT_ENVIRONMENT_KEY]: parsedInput.userAgent,
    [APP_SERVER_CODEX_CLIENT_IDENTIFIER_ENVIRONMENT_KEY]: parsedInput.clientId,
  };
}

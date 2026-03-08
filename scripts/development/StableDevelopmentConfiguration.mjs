import { z } from "zod";

const AgentIdSchema = z.enum(["codex", "opencode"]);
const AgentTokenSchema = z.union([AgentIdSchema, z.literal("all")]);
const PositiveIntegerSchema = z.coerce.number().int().min(1);
const OptionalNonEmptyStringSchema = z.string().trim().min(1).optional();

const ALL_AGENT_IDS = ["codex", "opencode"];
const DEFAULT_AGENT_IDS = ["codex"];
const DEFAULT_STABLE_DEVELOPMENT_HOST = "127.0.0.1";
const DEFAULT_STABLE_DEVELOPMENT_API_PORT = 4_411;
const DEFAULT_STABLE_DEVELOPMENT_WEB_PORT = 4_412;
const DEFAULT_STABLE_DEVELOPMENT_LIVE_RELOAD_PORT = 4_413;
const DEFAULT_STABLE_DEVELOPMENT_IDLE_MILLISECONDS = 60_000;
const DEFAULT_STABLE_DEVELOPMENT_POLL_INTERVAL_MILLISECONDS = 1_000;

function dedupeAgentIds(agentIds) {
  const dedupedAgentIds = [];
  const seenAgentIds = new Set();
  for (const agentId of agentIds) {
    if (seenAgentIds.has(agentId)) {
      continue;
    }
    seenAgentIds.add(agentId);
    dedupedAgentIds.push(agentId);
  }
  return dedupedAgentIds;
}

function parseAgentIds(rawAgentIds) {
  const trimmedAgentIds = rawAgentIds.trim();
  if (trimmedAgentIds.length === 0) {
    throw new Error("Missing value for --agents");
  }

  const tokens = trimmedAgentIds.split(",").map((token) => token.trim());
  if (tokens.length === 0 || tokens.some((token) => token.length === 0)) {
    throw new Error("Missing value for --agents");
  }

  const expandedAgentIds = [];
  for (const token of tokens) {
    const parsedToken = AgentTokenSchema.safeParse(token);
    if (!parsedToken.success) {
      throw new Error(
        `Unknown agent id "${token}". Allowed values: ${ALL_AGENT_IDS.join(", ")}, all`,
      );
    }

    if (parsedToken.data === "all") {
      expandedAgentIds.push(...ALL_AGENT_IDS);
      continue;
    }

    expandedAgentIds.push(parsedToken.data);
  }

  return dedupeAgentIds(expandedAgentIds);
}

function readOptionalPositiveIntegerEnvironmentValue(env, variableName, defaultValue) {
  const parsedValue = PositiveIntegerSchema.safeParse(env[variableName]);
  return parsedValue.success ? parsedValue.data : defaultValue;
}

function readOptionalHostEnvironmentValue(env, variableName, defaultValue) {
  const parsedValue = OptionalNonEmptyStringSchema.safeParse(env[variableName]);
  return parsedValue.success && parsedValue.data !== undefined ? parsedValue.data : defaultValue;
}

function parseStableDevelopmentArguments(argv) {
  let remote = false;
  let agentIds = [...DEFAULT_AGENT_IDS];
  let showHelp = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === undefined || argument.length === 0 || argument === "--") {
      continue;
    }

    if (argument === "--help" || argument === "-h") {
      showHelp = true;
      continue;
    }

    if (argument === "--remote") {
      remote = true;
      continue;
    }

    if (argument === "--agents") {
      const nextArgument = argv[index + 1];
      if (nextArgument === undefined || nextArgument.startsWith("--")) {
        throw new Error("Missing value for --agents");
      }
      agentIds = parseAgentIds(nextArgument);
      index += 1;
      continue;
    }

    if (argument.startsWith("--agents=")) {
      agentIds = parseAgentIds(argument.slice("--agents=".length));
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return {
    remote,
    agentIds,
    showHelp,
  };
}

export function formatStableDevelopmentHelpText() {
  return [
    "Usage: bun run dev:stable -- [--remote] [--agents=<ids>]",
    "",
    "Flags:",
    "  --remote                      Bind stable API, web, and live-reload servers to 0.0.0.0",
    "  --agents=<ids>                Comma-separated list: codex, opencode, all",
    "  --help                        Show this help message",
    "",
    "Environment:",
    "  FARFIELD_STABLE_DEV_API_PORT          Stable API port (default: 4411)",
    "  FARFIELD_STABLE_DEV_WEB_PORT          Stable web port (default: 4412)",
    "  FARFIELD_STABLE_DEV_LIVE_RELOAD_PORT  Stable live-reload port (default: 4413)",
    "  FARFIELD_STABLE_DEV_IDLE_MS           Quiet window before validation (default: 60000)",
    "  FARFIELD_STABLE_DEV_POLL_INTERVAL_MS  Repository polling interval (default: 1000)",
  ].join("\n");
}

export function readStableDevelopmentConfiguration(argv, env) {
  const parsedArguments = parseStableDevelopmentArguments(argv);
  const host = parsedArguments.remote
    ? "0.0.0.0"
    : readOptionalHostEnvironmentValue(
        env,
        "FARFIELD_STABLE_DEV_HOST",
        DEFAULT_STABLE_DEVELOPMENT_HOST,
      );
  const apiPort = readOptionalPositiveIntegerEnvironmentValue(
    env,
    "FARFIELD_STABLE_DEV_API_PORT",
    DEFAULT_STABLE_DEVELOPMENT_API_PORT,
  );
  const webPort = readOptionalPositiveIntegerEnvironmentValue(
    env,
    "FARFIELD_STABLE_DEV_WEB_PORT",
    DEFAULT_STABLE_DEVELOPMENT_WEB_PORT,
  );
  const liveReloadPort = readOptionalPositiveIntegerEnvironmentValue(
    env,
    "FARFIELD_STABLE_DEV_LIVE_RELOAD_PORT",
    DEFAULT_STABLE_DEVELOPMENT_LIVE_RELOAD_PORT,
  );
  const idleMilliseconds = readOptionalPositiveIntegerEnvironmentValue(
    env,
    "FARFIELD_STABLE_DEV_IDLE_MS",
    DEFAULT_STABLE_DEVELOPMENT_IDLE_MILLISECONDS,
  );
  const pollIntervalMilliseconds = readOptionalPositiveIntegerEnvironmentValue(
    env,
    "FARFIELD_STABLE_DEV_POLL_INTERVAL_MS",
    DEFAULT_STABLE_DEVELOPMENT_POLL_INTERVAL_MILLISECONDS,
  );

  const uniquePorts = new Set([apiPort, webPort, liveReloadPort]);
  if (uniquePorts.size !== 3) {
    throw new Error(
      `Stable development ports must be distinct. Received api=${String(apiPort)}, web=${String(webPort)}, liveReload=${String(liveReloadPort)}`,
    );
  }

  return {
    host,
    upstreamApiHost: DEFAULT_STABLE_DEVELOPMENT_HOST,
    apiPort,
    webPort,
    liveReloadPort,
    idleMilliseconds,
    pollIntervalMilliseconds,
    remote: parsedArguments.remote,
    agentIds: parsedArguments.agentIds,
    showHelp: parsedArguments.showHelp,
  };
}

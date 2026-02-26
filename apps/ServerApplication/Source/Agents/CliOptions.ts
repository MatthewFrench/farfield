import { z } from "zod";
import type { AgentId } from "./Types.js";

const AgentIdSchema = z.enum(["codex", "opencode"]);
const AgentTokenSchema = z.union([AgentIdSchema, z.literal("all")]);

const ALL_AGENTS_TOKEN = "all";
const AGENTS_LONG_OPTION = "--agents";
const AGENTS_EQUALS_PREFIX = `${AGENTS_LONG_OPTION}=`;
const HELP_LONG_OPTION = "--help";
const HELP_SHORT_OPTION = "-h";
const OPTION_TERMINATOR = "--";
const MISSING_AGENTS_VALUE_ERROR = `Missing value for ${AGENTS_LONG_OPTION}`;

export const ALL_AGENT_IDS: AgentId[] = ["codex", "opencode"];
export const DEFAULT_AGENT_IDS: AgentId[] = ["codex"];

export interface ServerCliOptions {
  agentIds: AgentId[];
  showHelp: boolean;
}

function formatAllowedAgentIds(): string {
  return ALL_AGENT_IDS.join(", ");
}

function buildUnknownAgentIdError(token: string): string {
  return `Unknown agent id "${token}". Allowed values: ${formatAllowedAgentIds()}, ${ALL_AGENTS_TOKEN}`;
}

function dedupeAgentIds(expandedAgentIds: AgentId[]): AgentId[] {
  const dedupedAgentIds: AgentId[] = [];
  const seenAgentIds = new Set<AgentId>();
  for (const agentId of expandedAgentIds) {
    if (seenAgentIds.has(agentId)) {
      continue;
    }

    seenAgentIds.add(agentId);
    dedupedAgentIds.push(agentId);
  }

  return dedupedAgentIds;
}

function parseAgentsArg(raw: string): AgentId[] {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error(MISSING_AGENTS_VALUE_ERROR);
  }

  const tokens = trimmed
    .split(",")
    .map((token) => token.trim());

  if (tokens.length === 0 || tokens.some((token) => token.length === 0)) {
    throw new Error(MISSING_AGENTS_VALUE_ERROR);
  }

  const expanded: AgentId[] = [];
  for (const token of tokens) {
    const parsedToken = AgentTokenSchema.safeParse(token);
    if (!parsedToken.success) {
      throw new Error(buildUnknownAgentIdError(token));
    }

    if (parsedToken.data === ALL_AGENTS_TOKEN) {
      expanded.push(...ALL_AGENT_IDS);
      continue;
    }

    expanded.push(parsedToken.data);
  }

  const deduped = dedupeAgentIds(expanded);

  if (deduped.length === 0) {
    throw new Error(
      `No valid agent ids were provided. Allowed values: ${formatAllowedAgentIds()}, ${ALL_AGENTS_TOKEN}`
    );
  }

  return deduped;
}

export function formatServerHelpText(): string {
  return [
    "Farfield server",
    "",
    `Usage: tsx watch Source/Application/ServerBootstrap.ts [${AGENTS_LONG_OPTION}=<ids>]`,
    "",
    "Flags:",
    `  ${AGENTS_LONG_OPTION}=<ids>   Comma-separated agent ids. Allowed: ${formatAllowedAgentIds()}, ${ALL_AGENTS_TOKEN}`,
    `  ${HELP_LONG_OPTION}           Show this help message`
  ].join("\n");
}

export function parseServerCliOptions(argv: string[]): ServerCliOptions {
  let parsedAgents: AgentId[] | null = null;
  let showHelp = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) {
      continue;
    }

    if (arg === OPTION_TERMINATOR) {
      continue;
    }

    if (arg === HELP_LONG_OPTION || arg === HELP_SHORT_OPTION) {
      showHelp = true;
      continue;
    }

    if (arg.startsWith(AGENTS_EQUALS_PREFIX)) {
      const value = arg.slice(AGENTS_EQUALS_PREFIX.length);
      parsedAgents = parseAgentsArg(value);
      continue;
    }

    if (arg === AGENTS_LONG_OPTION) {
      const nextArg = argv[index + 1];
      if (!nextArg || nextArg.startsWith("--")) {
        throw new Error(MISSING_AGENTS_VALUE_ERROR);
      }
      parsedAgents = parseAgentsArg(nextArg);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    agentIds: parsedAgents ?? [...DEFAULT_AGENT_IDS],
    showHelp
  };
}

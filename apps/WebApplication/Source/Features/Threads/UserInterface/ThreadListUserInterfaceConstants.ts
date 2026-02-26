import type { AgentId } from "@/Shared/Contracts/ApiContracts";

/**
 * Owns thread-list UI defaults and capability guards shared by list sections.
 * Archive and unarchive actions are currently supported only for Codex-backed threads.
 */
export const DEFAULT_THREAD_PROJECT_DIRECTORY = ".";
export const DEFAULT_AGENT_LABEL = "Agent";
export const THREAD_GROUP_NO_PROJECT_TOOLTIP = "No project";
export const THREAD_ARCHIVE_MUTATION_SUPPORTED_AGENT_IDENTIFIER: AgentId = "codex";

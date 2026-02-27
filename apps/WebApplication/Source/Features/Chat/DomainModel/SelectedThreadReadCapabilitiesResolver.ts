import type { AgentId } from "@/Shared/Contracts/ApiContracts";
import type { ThreadListItem } from "@/Features/Threads/DomainModel/ThreadGroupTypes";

interface AgentReadCapabilitiesContract {
  canReadLiveState: boolean;
  canReadStreamEvents: boolean;
}

interface AgentDescriptorContract {
  capabilities: AgentReadCapabilitiesContract;
}

interface ResolveReadCapabilitiesInput {
  threadId: string;
  threads: ThreadListItem[];
  selectedAgentId: AgentId;
  agentsById: Partial<Record<AgentId, AgentDescriptorContract>>;
}

export interface ReadCapabilities {
  canReadLiveState: boolean;
  canReadStreamEvents: boolean;
}

const DEFAULT_STREAM_READ_CAPABLE_AGENT_ID: AgentId = "codex";

export function resolveReadCapabilitiesForThread(input: ResolveReadCapabilitiesInput): ReadCapabilities {
  const thread = input.threads.find((entry) => entry.id === input.threadId) ?? null;
  const threadAgentId = thread?.agentId ?? input.selectedAgentId;
  const descriptor = input.agentsById[threadAgentId];
  const defaultReadCapability = threadAgentId === DEFAULT_STREAM_READ_CAPABLE_AGENT_ID;

  return {
    canReadLiveState: descriptor?.capabilities.canReadLiveState ?? defaultReadCapability,
    canReadStreamEvents: descriptor?.capabilities.canReadStreamEvents ?? defaultReadCapability
  };
}

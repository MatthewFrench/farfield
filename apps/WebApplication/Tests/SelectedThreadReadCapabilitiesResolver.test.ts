import { describe, expect, it } from "vitest";
import type { AgentId } from "@/Shared/Contracts/ApiContracts";
import type { ThreadListItem } from "@/Features/Threads/DomainModel/ThreadGroupTypes";
import { resolveReadCapabilitiesForThread } from "@/Features/Chat/DomainModel/SelectedThreadReadCapabilitiesResolver";

function buildThread(threadId: string, agentId: AgentId): ThreadListItem {
  return {
    id: threadId,
    preview: `${threadId}-preview`,
    createdAt: 1,
    updatedAt: 2,
    agentId
  };
}

describe("SelectedThreadReadCapabilitiesResolver", () => {
  it("uses descriptor capabilities for the thread agent when present", () => {
    const capabilities = resolveReadCapabilitiesForThread({
      threadId: "thread-1",
      threads: [buildThread("thread-1", "opencode")],
      selectedAgentId: "codex",
      agentsById: {
        opencode: {
          capabilities: {
            canReadLiveState: true,
            canReadStreamEvents: false
          }
        }
      }
    });

    expect(capabilities).toEqual({
      canReadLiveState: true,
      canReadStreamEvents: false
    });
  });

  it("defaults to codex stream/live capabilities when descriptors are absent", () => {
    const capabilities = resolveReadCapabilitiesForThread({
      threadId: "thread-1",
      threads: [buildThread("thread-1", "codex")],
      selectedAgentId: "codex",
      agentsById: {}
    });

    expect(capabilities).toEqual({
      canReadLiveState: true,
      canReadStreamEvents: true
    });
  });

  it("defaults to disabled stream/live capabilities for non-codex agents without descriptors", () => {
    const capabilities = resolveReadCapabilitiesForThread({
      threadId: "thread-1",
      threads: [buildThread("thread-1", "opencode")],
      selectedAgentId: "codex",
      agentsById: {}
    });

    expect(capabilities).toEqual({
      canReadLiveState: false,
      canReadStreamEvents: false
    });
  });
});

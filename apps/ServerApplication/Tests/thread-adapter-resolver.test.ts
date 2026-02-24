import { describe, expect, it } from "vitest";
import { AgentRegistry } from "../Source/Agents/Registry.js";
import { ThreadAdapterResolver } from "../Source/Agents/ThreadAdapterResolver.js";
import { ThreadIndex } from "../Source/Agents/ThreadIndex.js";
import type { AgentAdapter, AgentCapabilities, AgentId } from "../Source/Agents/Types.js";

const defaultCapabilities: AgentCapabilities = {
  canListModels: false,
  canListCollaborationModes: false,
  canSetCollaborationMode: false,
  canSubmitUserInput: false,
  canReadLiveState: false,
  canReadStreamEvents: false
};

function createAdapter(input: {
  id: AgentId;
  enabled: boolean;
  connected: boolean;
}): AgentAdapter {
  return {
    id: input.id,
    label: input.id,
    capabilities: defaultCapabilities,
    async start(): Promise<void> {},
    async stop(): Promise<void> {},
    isEnabled(): boolean {
      return input.enabled;
    },
    isConnected(): boolean {
      return input.connected;
    },
    async listThreads(): Promise<never> {
      throw new Error("not used in this test");
    },
    async createThread(): Promise<never> {
      throw new Error("not used in this test");
    },
    async readThread(): Promise<never> {
      throw new Error("not used in this test");
    },
    async sendMessage(): Promise<void> {
      throw new Error("not used in this test");
    },
    async interrupt(): Promise<void> {
      throw new Error("not used in this test");
    }
  };
}

describe("ThreadAdapterResolver", () => {
  it("resolves create-thread adapter from requested id or default enabled agent", () => {
    const codexAdapter = createAdapter({ id: "codex", enabled: true, connected: true });
    const opencodeAdapter = createAdapter({ id: "opencode", enabled: false, connected: true });
    const registry = new AgentRegistry([codexAdapter, opencodeAdapter]);
    const resolver = new ThreadAdapterResolver(registry, new ThreadIndex());

    expect(resolver.resolveCreateThreadAdapter("codex")).toBe(codexAdapter);
    expect(resolver.resolveCreateThreadAdapter("opencode")).toBeNull();
    expect(resolver.resolveCreateThreadAdapter(undefined)).toBe(codexAdapter);
  });

  it("resolves thread adapter with strict registration and connection checks", () => {
    const codexAdapter = createAdapter({ id: "codex", enabled: true, connected: true });
    const opencodeAdapter = createAdapter({ id: "opencode", enabled: true, connected: false });
    const registry = new AgentRegistry([codexAdapter, opencodeAdapter]);
    const resolver = new ThreadAdapterResolver(registry, new ThreadIndex());

    const missing = resolver.resolveAdapterForThread("thread_missing");
    expect(missing.ok).toBe(false);
    if (missing.ok) {
      throw new Error("expected missing thread to fail");
    }
    expect(missing.status).toBe(404);

    resolver.registerThreadOwner("thread_1", "codex");
    const resolvedCodex = resolver.resolveAdapterForThread("thread_1");
    expect(resolvedCodex.ok).toBe(true);
    if (!resolvedCodex.ok) {
      throw new Error("expected codex thread to resolve");
    }
    expect(resolvedCodex.agentId).toBe("codex");

    resolver.registerThreadOwner("thread_2", "opencode");
    const disconnected = resolver.resolveAdapterForThread("thread_2");
    expect(disconnected.ok).toBe(false);
    if (disconnected.ok) {
      throw new Error("expected disconnected thread to fail");
    }
    expect(disconnected.status).toBe(503);
    expect(disconnected.error).toContain("not connected");
  });
});

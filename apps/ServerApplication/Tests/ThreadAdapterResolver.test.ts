import { AppServerRpcError } from "@farfield/api";
import { parseThreadConversationState } from "@farfield/protocol";
import { describe, expect, it } from "vitest";
import { AgentRegistry } from "../Source/Agents/Registry.js";
import { ThreadAdapterResolver } from "../Source/Agents/ThreadAdapterResolver.js";
import { ThreadIndex } from "../Source/Agents/ThreadIndex.js";
import type {
  AgentAdapter,
  AgentCapabilities,
  AgentId,
  AgentReadThreadInput,
  AgentReadThreadResult,
} from "../Source/Agents/Types.js";

const defaultCapabilities: AgentCapabilities = {
  canListModels: false,
  canListCollaborationModes: false,
  canSetCollaborationMode: false,
  canSubmitUserInput: false,
  canReadLiveState: false,
  canReadStreamEvents: false,
};

function createThreadMissingError(): AppServerRpcError {
  return new AppServerRpcError(-32600, "conversation not found");
}

function createAdapter(input: {
  id: AgentId;
  enabled: boolean;
  connected: boolean;
  readThread?: (input: AgentReadThreadInput) => Promise<AgentReadThreadResult>;
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
    async readThread(inputReadThread: AgentReadThreadInput): Promise<AgentReadThreadResult> {
      if (input.readThread) {
        return input.readThread(inputReadThread);
      }
      throw new Error("not used in this test");
    },
    async sendMessage(): Promise<void> {
      throw new Error("not used in this test");
    },
    async interrupt(): Promise<void> {
      throw new Error("not used in this test");
    },
  };
}

describe("ThreadAdapterResolver", () => {
  it("resolves create-thread adapter from requested id or default connected enabled agent", () => {
    const codexAdapter = createAdapter({ id: "codex", enabled: true, connected: true });
    const opencodeAdapter = createAdapter({ id: "opencode", enabled: false, connected: true });
    const registry = new AgentRegistry([codexAdapter, opencodeAdapter]);
    const resolver = new ThreadAdapterResolver(registry, new ThreadIndex());

    expect(resolver.resolveCreateThreadAdapter("codex")).toBe(codexAdapter);
    expect(resolver.resolveCreateThreadAdapter("opencode")).toBeNull();
    expect(resolver.resolveCreateThreadAdapter(undefined)).toBe(codexAdapter);
  });

  it("selects another connected enabled adapter when default is disconnected", () => {
    const codexAdapter = createAdapter({ id: "codex", enabled: true, connected: false });
    const opencodeAdapter = createAdapter({ id: "opencode", enabled: true, connected: true });
    const registry = new AgentRegistry([codexAdapter, opencodeAdapter]);
    const resolver = new ThreadAdapterResolver(registry, new ThreadIndex());

    expect(resolver.resolveCreateThreadAdapter(undefined)).toBe(opencodeAdapter);
    expect(resolver.resolveCreateThreadAdapter("codex")).toBeNull();
  });

  it("resolves thread adapter with strict registration and connection checks", async () => {
    const codexAdapter = createAdapter({
      id: "codex",
      enabled: true,
      connected: true,
      readThread: async () => {
        throw createThreadMissingError();
      },
    });
    const opencodeAdapter = createAdapter({ id: "opencode", enabled: true, connected: false });
    const registry = new AgentRegistry([codexAdapter, opencodeAdapter]);
    const resolver = new ThreadAdapterResolver(registry, new ThreadIndex());

    const missing = await resolver.resolveAdapterForThread("thread_missing");
    expect(missing.ok).toBe(false);
    if (missing.ok) {
      throw new Error("expected missing thread to fail");
    }
    expect(missing.status).toBe(404);

    resolver.registerThreadOwner("thread_1", "codex");
    const resolvedCodex = await resolver.resolveAdapterForThread("thread_1");
    expect(resolvedCodex.ok).toBe(true);
    if (!resolvedCodex.ok) {
      throw new Error("expected codex thread to resolve");
    }
    expect(resolvedCodex.agentId).toBe("codex");

    resolver.registerThreadOwner("thread_2", "opencode");
    const disconnected = await resolver.resolveAdapterForThread("thread_2");
    expect(disconnected.ok).toBe(false);
    if (disconnected.ok) {
      throw new Error("expected disconnected thread to fail");
    }
    expect(disconnected.status).toBe(503);
    expect(disconnected.error).toContain("not connected");
  });

  it("discovers unregistered thread ownership by probing connected enabled adapters", async () => {
    const codexAdapter = createAdapter({
      id: "codex",
      enabled: true,
      connected: true,
      readThread: async (input) => {
        if (input.threadId !== "thread_discovered") {
          throw new Error("thread not found");
        }
        return {
          thread: parseThreadConversationState({
            id: input.threadId,
            turns: [],
            requests: [],
          }),
        };
      },
    });
    const opencodeAdapter = createAdapter({
      id: "opencode",
      enabled: true,
      connected: true,
      readThread: async () => {
        throw createThreadMissingError();
      },
    });
    const threadIndex = new ThreadIndex();
    const registry = new AgentRegistry([codexAdapter, opencodeAdapter]);
    const resolver = new ThreadAdapterResolver(registry, threadIndex);

    const discovered = await resolver.resolveAdapterForThread("thread_discovered");
    expect(discovered.ok).toBe(true);
    if (!discovered.ok) {
      throw new Error("expected discovered thread to resolve");
    }
    expect(discovered.agentId).toBe("codex");
    expect(threadIndex.resolve("thread_discovered")).toBe("codex");
  });

  it("probes connected enabled adapters in registry order during discovery", async () => {
    const probeOrder: AgentId[] = [];
    const codexAdapter = createAdapter({
      id: "codex",
      enabled: true,
      connected: true,
      readThread: async () => {
        probeOrder.push("codex");
        throw createThreadMissingError();
      },
    });
    const opencodeAdapter = createAdapter({
      id: "opencode",
      enabled: true,
      connected: true,
      readThread: async (input) => {
        probeOrder.push("opencode");
        if (input.threadId !== "thread_ordered_discovery") {
          throw createThreadMissingError();
        }
        return {
          thread: parseThreadConversationState({
            id: input.threadId,
            turns: [],
            requests: [],
          }),
        };
      },
    });
    const threadIndex = new ThreadIndex();
    const resolver = new ThreadAdapterResolver(
      new AgentRegistry([codexAdapter, opencodeAdapter]),
      threadIndex,
    );

    const discovered = await resolver.resolveAdapterForThread("thread_ordered_discovery");
    expect(discovered.ok).toBe(true);
    if (!discovered.ok) {
      throw new Error("expected ordered discovery to resolve");
    }
    expect(discovered.agentId).toBe("opencode");
    expect(probeOrder).toStrictEqual(["codex", "opencode"]);
    expect(threadIndex.resolve("thread_ordered_discovery")).toBe("opencode");
  });

  it("tracks repeated discovery misses and aggregates threshold alerts", async () => {
    const codexAdapter = createAdapter({
      id: "codex",
      enabled: true,
      connected: true,
      readThread: async () => {
        throw createThreadMissingError();
      },
    });
    let nowEpochMs = 100;
    const resolver = new ThreadAdapterResolver(
      new AgentRegistry([codexAdapter]),
      new ThreadIndex(),
      {
        now: () => nowEpochMs,
        unregisteredThreadMissTimeToLiveMs: 10,
      },
    );

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const missing = await resolver.resolveAdapterForThread("thread_missing_repeated");
      expect(missing.ok).toBe(false);
      if (missing.ok) {
        throw new Error("expected repeated missing thread to fail");
      }
      expect(missing.status).toBe(404);
      nowEpochMs += 11;
    }

    const statistics = resolver.readStatistics();
    expect(statistics.unregisteredDiscoveryAttemptCount).toBe(3);
    expect(statistics.unregisteredDiscoveryMissCount).toBe(3);
    expect(statistics.unregisteredDiscoveryAlertCount).toBe(1);
  });

  it("uses miss cache to avoid repeated adapter probes for unknown thread ids", async () => {
    let nowEpochMs = 1_000;
    let readThreadCount = 0;
    const codexAdapter = createAdapter({
      id: "codex",
      enabled: true,
      connected: true,
      readThread: async () => {
        readThreadCount += 1;
        throw createThreadMissingError();
      },
    });
    const resolver = new ThreadAdapterResolver(
      new AgentRegistry([codexAdapter]),
      new ThreadIndex(),
      {
        now: () => nowEpochMs,
        unregisteredThreadMissTimeToLiveMs: 50,
      },
    );

    const firstMissing = await resolver.resolveAdapterForThread("thread_miss_cached");
    expect(firstMissing.ok).toBe(false);
    if (firstMissing.ok) {
      throw new Error("expected first missing thread request to fail");
    }
    expect(firstMissing.status).toBe(404);
    expect(readThreadCount).toBe(1);

    nowEpochMs += 25;
    const cachedMissing = await resolver.resolveAdapterForThread("thread_miss_cached");
    expect(cachedMissing.ok).toBe(false);
    if (cachedMissing.ok) {
      throw new Error("expected cached missing thread request to fail");
    }
    expect(cachedMissing.status).toBe(404);
    expect(readThreadCount).toBe(1);

    nowEpochMs += 60;
    const refreshedMissing = await resolver.resolveAdapterForThread("thread_miss_cached");
    expect(refreshedMissing.ok).toBe(false);
    if (refreshedMissing.ok) {
      throw new Error("expected refreshed missing thread request to fail");
    }
    expect(refreshedMissing.status).toBe(404);
    expect(readThreadCount).toBe(2);

    const statistics = resolver.readStatistics();
    expect(statistics.unregisteredDiscoveryAttemptCount).toBe(2);
    expect(statistics.unregisteredDiscoveryMissCount).toBe(2);
    expect(statistics.unregisteredDiscoveryMissCacheHitCount).toBe(1);
  });

  it("reports ambiguity when multiple connected enabled adapters own a thread", async () => {
    const codexAdapter = createAdapter({
      id: "codex",
      enabled: true,
      connected: true,
      readThread: async (input) => {
        if (input.threadId !== "thread_ambiguous") {
          throw createThreadMissingError();
        }
        return {
          thread: parseThreadConversationState({
            id: input.threadId,
            turns: [],
            requests: [],
          }),
        };
      },
    });
    const opencodeAdapter = createAdapter({
      id: "opencode",
      enabled: true,
      connected: true,
      readThread: async (input) => {
        if (input.threadId !== "thread_ambiguous") {
          throw createThreadMissingError();
        }
        return {
          thread: parseThreadConversationState({
            id: input.threadId,
            turns: [],
            requests: [],
          }),
        };
      },
    });
    const resolver = new ThreadAdapterResolver(
      new AgentRegistry([codexAdapter, opencodeAdapter]),
      new ThreadIndex(),
    );

    const ambiguous = await resolver.resolveAdapterForThread("thread_ambiguous");
    expect(ambiguous.ok).toBe(false);
    if (ambiguous.ok) {
      throw new Error("expected ambiguity to fail");
    }
    expect(ambiguous.status).toBe(409);
    expect(ambiguous.error).toContain("matched multiple connected enabled agents");

    const statistics = resolver.readStatistics();
    expect(statistics.unregisteredDiscoveryAmbiguousCount).toBe(1);
  });

  it("returns service-unavailable when adapter probe fails with non-missing error", async () => {
    const codexAdapter = createAdapter({
      id: "codex",
      enabled: true,
      connected: true,
      readThread: async () => {
        throw new Error("app-server request timed out");
      },
    });
    const resolver = new ThreadAdapterResolver(
      new AgentRegistry([codexAdapter]),
      new ThreadIndex(),
    );

    const unavailable = await resolver.resolveAdapterForThread("thread_probe_failure");
    expect(unavailable.ok).toBe(false);
    if (unavailable.ok) {
      throw new Error("expected probe failure to return service unavailable");
    }
    expect(unavailable.status).toBe(503);
    expect(unavailable.error).toContain("ownership probe failed");

    const statistics = resolver.readStatistics();
    expect(statistics.unregisteredDiscoveryAttemptCount).toBe(1);
    expect(statistics.unregisteredDiscoveryProbeFailureCount).toBe(1);
    expect(statistics.unregisteredDiscoveryMissCount).toBe(0);
  });

  it("rejects non-positive or non-integer miss cache ttl configuration", () => {
    const registry = new AgentRegistry([]);
    const threadIndex = new ThreadIndex();

    expect(() => {
      new ThreadAdapterResolver(registry, threadIndex, {
        unregisteredThreadMissTimeToLiveMs: 0,
      });
    }).toThrowError(
      "ThreadAdapterResolver requires positive integer unregisteredThreadMissTimeToLiveMs",
    );

    expect(() => {
      new ThreadAdapterResolver(registry, threadIndex, {
        unregisteredThreadMissTimeToLiveMs: 1.5,
      });
    }).toThrowError(
      "ThreadAdapterResolver requires positive integer unregisteredThreadMissTimeToLiveMs",
    );
  });
});

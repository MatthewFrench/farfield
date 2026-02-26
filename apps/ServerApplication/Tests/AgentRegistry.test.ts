import { describe, expect, it } from "vitest";
import { AgentRegistry } from "../Source/Agents/Registry.js";
import type {
  AgentAdapter,
  AgentCapabilities,
  AgentCreateThreadInput,
  AgentCreateThreadResult,
  AgentId,
  AgentInterruptInput,
  AgentListThreadsInput,
  AgentListThreadsResult,
  AgentReadThreadInput,
  AgentReadThreadResult,
  AgentSendMessageInput
} from "../Source/Agents/Types.js";

const DEFAULT_CAPABILITIES: AgentCapabilities = {
  canListModels: false,
  canListCollaborationModes: false,
  canSetCollaborationMode: false,
  canSubmitUserInput: false,
  canReadLiveState: false,
  canReadStreamEvents: false
};

interface AgentAdapterFactoryInput {
  id: AgentId;
  enabled: boolean;
  connected: boolean;
  capabilities?: Partial<AgentCapabilities>;
  onStart?: () => void;
  onStop?: () => void;
}

function createAgentAdapter(input: AgentAdapterFactoryInput): AgentAdapter {
  const capabilities: AgentCapabilities = {
    ...DEFAULT_CAPABILITIES,
    ...input.capabilities
  };

  return {
    id: input.id,
    label: input.id,
    capabilities,
    async start(): Promise<void> {
      input.onStart?.();
    },
    async stop(): Promise<void> {
      input.onStop?.();
    },
    isEnabled(): boolean {
      return input.enabled;
    },
    isConnected(): boolean {
      return input.connected;
    },
    async listThreads(_input: AgentListThreadsInput): Promise<AgentListThreadsResult> {
      throw new Error("not used in this test");
    },
    async createThread(_input: AgentCreateThreadInput): Promise<AgentCreateThreadResult> {
      throw new Error("not used in this test");
    },
    async readThread(_input: AgentReadThreadInput): Promise<AgentReadThreadResult> {
      throw new Error("not used in this test");
    },
    async sendMessage(_input: AgentSendMessageInput): Promise<void> {
      throw new Error("not used in this test");
    },
    async interrupt(_input: AgentInterruptInput): Promise<void> {
      throw new Error("not used in this test");
    }
  };
}

describe("AgentRegistry", () => {
  it("rejects duplicate adapter identifiers", () => {
    const firstAdapter = createAgentAdapter({
      id: "codex",
      enabled: true,
      connected: true
    });
    const secondAdapter = createAgentAdapter({
      id: "codex",
      enabled: true,
      connected: true
    });

    expect(() => new AgentRegistry([firstAdapter, secondAdapter])).toThrowError(
      /Duplicate agent adapter id/
    );
  });

  it("resolves default agent id from first enabled adapter in registry order", () => {
    const codexAdapter = createAgentAdapter({
      id: "codex",
      enabled: false,
      connected: true
    });
    const opencodeAdapter = createAgentAdapter({
      id: "opencode",
      enabled: true,
      connected: false
    });
    const registry = new AgentRegistry([codexAdapter, opencodeAdapter]);

    expect(registry.resolveDefaultAgentId()).toBe("opencode");
  });

  it("resolves first connected enabled adapter that supports requested capability", () => {
    const codexAdapter = createAgentAdapter({
      id: "codex",
      enabled: true,
      connected: false,
      capabilities: { canReadStreamEvents: true }
    });
    const opencodeAdapter = createAgentAdapter({
      id: "opencode",
      enabled: true,
      connected: true,
      capabilities: { canReadStreamEvents: true }
    });
    const registry = new AgentRegistry([codexAdapter, opencodeAdapter]);

    expect(registry.resolveFirstWithCapability("canReadStreamEvents")).toBe(opencodeAdapter);
  });

  it("starts adapters in registration order and stops adapters in reverse order", async () => {
    const lifecycleEvents: string[] = [];
    const codexAdapter = createAgentAdapter({
      id: "codex",
      enabled: true,
      connected: true,
      onStart: () => lifecycleEvents.push("start-codex"),
      onStop: () => lifecycleEvents.push("stop-codex")
    });
    const opencodeAdapter = createAgentAdapter({
      id: "opencode",
      enabled: true,
      connected: true,
      onStart: () => lifecycleEvents.push("start-opencode"),
      onStop: () => lifecycleEvents.push("stop-opencode")
    });
    const registry = new AgentRegistry([codexAdapter, opencodeAdapter]);

    await registry.startAll();
    await registry.stopAll();

    expect(lifecycleEvents).toEqual([
      "start-codex",
      "start-opencode",
      "stop-opencode",
      "stop-codex"
    ]);
  });
});

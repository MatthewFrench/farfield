import type { AgentAdapter, AgentCapabilities, AgentId } from "./Types.js";

const DUPLICATE_AGENT_ADAPTER_IDENTIFIER_ERROR_PREFIX = "Duplicate agent adapter id";

export class AgentRegistry {
  private readonly ordered: AgentAdapter[];
  private readonly byId: Map<AgentId, AgentAdapter>;

  public constructor(adapters: AgentAdapter[]) {
    this.ordered = [];
    this.byId = new Map();

    for (const adapter of adapters) {
      if (this.byId.has(adapter.id)) {
        throw new Error(`${DUPLICATE_AGENT_ADAPTER_IDENTIFIER_ERROR_PREFIX}: ${adapter.id}`);
      }
      this.byId.set(adapter.id, adapter);
      this.ordered.push(adapter);
    }
  }

  public listAdapters(): AgentAdapter[] {
    return [...this.ordered];
  }

  public getAdapter(id: AgentId): AgentAdapter | null {
    return this.byId.get(id) ?? null;
  }

  public listEnabled(): AgentAdapter[] {
    return this.ordered.filter((adapter) => adapter.isEnabled());
  }

  public resolveDefaultAgentId(): AgentId | null {
    for (const adapter of this.ordered) {
      if (adapter.isEnabled()) {
        return adapter.id;
      }
    }

    return null;
  }

  public resolveFirstWithCapability(capability: keyof AgentCapabilities): AgentAdapter | null {
    for (const adapter of this.ordered) {
      if (adapter.isEnabled() && adapter.isConnected() && adapter.capabilities[capability]) {
        return adapter;
      }
    }

    return null;
  }

  public async startAll(): Promise<void> {
    for (const adapter of this.ordered) {
      await adapter.start();
    }
  }

  public async stopAll(): Promise<void> {
    const reversed = [...this.ordered].reverse();
    for (const adapter of reversed) {
      await adapter.stop();
    }
  }
}

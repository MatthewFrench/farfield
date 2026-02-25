import type { AgentRegistry } from "./Registry.js";
import type { ThreadIndex } from "./ThreadIndex.js";
import type { AgentAdapter, AgentId } from "./Types.js";

export type ResolvedThreadAdapterResult =
  | { ok: true; adapter: AgentAdapter; agentId: AgentId }
  | { ok: false; status: number; error: string };

/**
 * Owns thread-to-adapter resolution. When ownership is missing, it performs a
 * deterministic read probe across connected enabled adapters and persists the discovered owner.
 */
export class ThreadAdapterResolver {
  private readonly registry: AgentRegistry;
  private readonly threadIndex: ThreadIndex;

  public constructor(registry: AgentRegistry, threadIndex: ThreadIndex) {
    this.registry = registry;
    this.threadIndex = threadIndex;
  }

  public registerThreadOwner(threadId: string, agentId: AgentId): void {
    this.threadIndex.register(threadId, agentId);
  }

  public resolveCreateThreadAdapter(requestedAgentId: AgentId | undefined): AgentAdapter | null {
    if (requestedAgentId) {
      const requestedAdapter = this.registry.getAdapter(requestedAgentId);
      if (!requestedAdapter || !requestedAdapter.isEnabled() || !requestedAdapter.isConnected()) {
        return null;
      }

      return requestedAdapter;
    }

    const defaultAgentId = this.registry.resolveDefaultAgentId();
    if (defaultAgentId) {
      const defaultAdapter = this.registry.getAdapter(defaultAgentId);
      if (defaultAdapter && defaultAdapter.isEnabled() && defaultAdapter.isConnected()) {
        return defaultAdapter;
      }
    }

    for (const enabledAdapter of this.registry.listEnabled()) {
      if (enabledAdapter.isConnected()) {
        return enabledAdapter;
      }
    }

    return null;
  }

  public async resolveAdapterForThread(threadId: string): Promise<ResolvedThreadAdapterResult> {
    const registeredAgentId = this.threadIndex.resolve(threadId);
    if (registeredAgentId) {
      return this.resolveRegisteredAdapter(threadId, registeredAgentId);
    }

    const discoveredAdapter = await this.discoverAdapterForUnregisteredThread(threadId);
    if (discoveredAdapter) {
      return discoveredAdapter;
    }

    return {
      ok: false,
      status: 404,
      error: `Thread ${threadId} is not registered and could not be discovered. Refresh thread list and try again.`
    };
  }

  private resolveRegisteredAdapter(
    threadId: string,
    registeredAgentId: AgentId
  ): ResolvedThreadAdapterResult {
    const adapter = this.registry.getAdapter(registeredAgentId);
    if (!adapter || !adapter.isEnabled()) {
      return {
        ok: false,
        status: 503,
        error: `Agent ${registeredAgentId} is not enabled for thread ${threadId}.`
      };
    }

    if (!adapter.isConnected()) {
      return {
        ok: false,
        status: 503,
        error: `Agent ${registeredAgentId} is not connected for thread ${threadId}.`
      };
    }

    return {
      ok: true,
      adapter,
      agentId: registeredAgentId
    };
  }

  private async discoverAdapterForUnregisteredThread(
    threadId: string
  ): Promise<ResolvedThreadAdapterResult | null> {
    const connectedEnabledAdapters = this.registry
      .listEnabled()
      .filter((adapter) => adapter.isConnected());

    if (connectedEnabledAdapters.length === 0) {
      return {
        ok: false,
        status: 503,
        error: `No connected enabled agents are available to resolve thread ${threadId}.`
      };
    }

    let discoveredAdapter: AgentAdapter | null = null;
    for (const adapter of connectedEnabledAdapters) {
      const adapterOwnsThread = await this.adapterOwnsThread(adapter, threadId);
      if (!adapterOwnsThread) {
        continue;
      }

      if (discoveredAdapter) {
        return {
          ok: false,
          status: 409,
          error: (
            `Thread ${threadId} matched multiple connected enabled agents `
            + `(${discoveredAdapter.id}, ${adapter.id}). Refresh thread list and retry.`
          )
        };
      }

      discoveredAdapter = adapter;
    }

    if (!discoveredAdapter) {
      return null;
    }

    this.threadIndex.register(threadId, discoveredAdapter.id);
    return {
      ok: true,
      adapter: discoveredAdapter,
      agentId: discoveredAdapter.id
    };
  }

  private async adapterOwnsThread(adapter: AgentAdapter, threadId: string): Promise<boolean> {
    try {
      await adapter.readThread({
        threadId,
        includeTurns: false
      });
      return true;
    } catch {
      return false;
    }
  }
}

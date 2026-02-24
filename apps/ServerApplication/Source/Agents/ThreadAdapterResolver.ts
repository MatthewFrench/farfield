import type { AgentRegistry } from "./Registry.js";
import type { ThreadIndex } from "./ThreadIndex.js";
import type { AgentAdapter, AgentId } from "./Types.js";

export type ResolvedThreadAdapterResult =
  | { ok: true; adapter: AgentAdapter; agentId: AgentId }
  | { ok: false; status: number; error: string };

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

  public resolveAdapterForThread(threadId: string): ResolvedThreadAdapterResult {
    const registeredAgentId = this.threadIndex.resolve(threadId);
    if (!registeredAgentId) {
      return {
        ok: false,
        status: 404,
        error: `Thread ${threadId} is not registered. Refresh thread list and try again.`
      };
    }

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
}

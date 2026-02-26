import type { AgentId } from "./Types.js";

const THREAD_OWNER_CONFLICT_ERROR_PREFIX = "Thread owner mismatch";

export class ThreadIndex {
  private readonly agentIdByThreadId = new Map<string, AgentId>();

  public register(threadId: string, agentId: AgentId): void {
    const registeredAgentId = this.agentIdByThreadId.get(threadId);
    if (registeredAgentId !== undefined && registeredAgentId !== agentId) {
      throw new Error(
        (
          `${THREAD_OWNER_CONFLICT_ERROR_PREFIX}: thread ${threadId} is already bound `
          + `to ${registeredAgentId} and cannot be reassigned to ${agentId}`
        )
      );
    }

    this.agentIdByThreadId.set(threadId, agentId);
  }

  public resolve(threadId: string): AgentId | null {
    return this.agentIdByThreadId.get(threadId) ?? null;
  }

  public list(): Array<{ threadId: string; agentId: AgentId }> {
    return Array.from(this.agentIdByThreadId.entries()).map(([threadId, agentId]) => ({
      threadId,
      agentId
    }));
  }
}

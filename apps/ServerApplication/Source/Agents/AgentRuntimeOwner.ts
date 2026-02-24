import { AgentRegistry } from "./Registry.js";
import { CodexAgentAdapter, type CodexIpcFrameEvent } from "./Adapters/CodexAgent.js";
import { OpenCodeAgentAdapter } from "./Adapters/OpencodeAgent.js";
import type { AgentAdapter, AgentId } from "./Types.js";

export interface AgentRuntimeOwnerDependencies {
  configuredAgentIds: AgentId[];
  codexExecutablePath: string;
  ipcSocketPath: string;
  defaultWorkspacePath: string;
  userAgent: string;
  ipcReconnectDelayMs: number;
  onCodexStateChange: () => void;
  onCodexFrame: (event: CodexIpcFrameEvent) => void;
  onThreadStreamStateChanged: (threadId: string) => void;
}

export class AgentRuntimeOwner {
  private readonly registry: AgentRegistry;
  private codexAdapter: CodexAgentAdapter | null;
  private openCodeAdapter: OpenCodeAgentAdapter | null;

  public constructor(dependencies: AgentRuntimeOwnerDependencies) {
    this.codexAdapter = null;
    this.openCodeAdapter = null;

    this.registry = new AgentRegistry(this.createAdapters(dependencies));
  }

  public readRegistry(): AgentRegistry {
    return this.registry;
  }

  public readCodexAdapter(): CodexAgentAdapter | null {
    return this.codexAdapter;
  }

  public readOpenCodeAdapter(): OpenCodeAgentAdapter | null {
    return this.openCodeAdapter;
  }

  private createAdapters(dependencies: AgentRuntimeOwnerDependencies): AgentAdapter[] {
    const adapters: AgentAdapter[] = [];

    for (const agentId of dependencies.configuredAgentIds) {
      if (agentId === "codex") {
        this.codexAdapter = new CodexAgentAdapter({
          appExecutable: dependencies.codexExecutablePath,
          socketPath: dependencies.ipcSocketPath,
          workspaceDir: dependencies.defaultWorkspacePath,
          userAgent: dependencies.userAgent,
          reconnectDelayMs: dependencies.ipcReconnectDelayMs,
          onStateChange: dependencies.onCodexStateChange
        });

        this.codexAdapter.onIpcFrame((event) => {
          dependencies.onCodexFrame(event);
          if (event.method === "thread-stream-state-changed" && event.threadId) {
            dependencies.onThreadStreamStateChanged(event.threadId);
          }
        });

        adapters.push(this.codexAdapter);
        continue;
      }

      if (agentId === "opencode") {
        this.openCodeAdapter = new OpenCodeAgentAdapter();
        adapters.push(this.openCodeAdapter);
      }
    }

    return adapters;
  }
}

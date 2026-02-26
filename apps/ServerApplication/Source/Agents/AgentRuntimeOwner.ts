import { AgentRegistry } from "./Registry.js";
import { CodexAgentAdapter, type CodexIpcFrameEvent } from "./Adapters/CodexAgentAdapter.js";
import { OpenCodeAgentAdapter } from "./Adapters/OpenCodeAgentAdapter.js";
import {
  THREAD_STREAM_STATE_CHANGED_METHOD,
  type ThreadStreamStateChangedMethod
} from "./ThreadStreamStateChangedContract.js";
import type { AgentAdapter, AgentId } from "./Types.js";

const CODEX_AGENT_IDENTIFIER: AgentId = "codex";
const OPEN_CODE_AGENT_IDENTIFIER: AgentId = "opencode";
const INBOUND_IPC_FRAME_DIRECTION = "in";

export interface AgentRuntimeOwnerDependencies {
  configuredAgentIds: AgentId[];
  codexExecutablePath: string;
  appServerBaseEnvironment: NodeJS.ProcessEnv;
  ipcSocketPath: string;
  invalidStreamEventsLogPath: string;
  defaultWorkspacePath: string;
  userAgent: string;
  ipcReconnectDelayMs: number;
  onCodexStateChange: () => void;
  onCodexFrame: (event: CodexIpcFrameEvent) => void;
  onThreadStreamStateChanged: (threadId: string) => void;
}

function hasNonWhitespaceThreadIdentifier(threadId: string | null): threadId is string {
  if (threadId === null) {
    return false;
  }
  return threadId.trim().length > 0;
}

/**
 * Completion scheduling should only react to real inbound stream updates.
 * Outbound replay preview frames are diagnostic-only and must not trigger side effects.
 */
export function shouldScheduleThreadStreamStateChanged(
  event: CodexIpcFrameEvent
): event is CodexIpcFrameEvent & {
  direction: "in";
  method: ThreadStreamStateChangedMethod;
  threadId: string;
} {
  if (event.direction !== INBOUND_IPC_FRAME_DIRECTION) {
    return false;
  }
  if (event.method !== THREAD_STREAM_STATE_CHANGED_METHOD) {
    return false;
  }
  return hasNonWhitespaceThreadIdentifier(event.threadId);
}

/**
 * Owns one-time runtime adapter composition and lifecycle wiring.
 * Adapter registration order is preserved from `configuredAgentIds` so downstream
 * default-resolution behavior remains deterministic.
 */
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
      if (agentId === CODEX_AGENT_IDENTIFIER) {
        adapters.push(this.createAndWireCodexAdapter(dependencies));
        continue;
      }

      if (agentId === OPEN_CODE_AGENT_IDENTIFIER) {
        adapters.push(this.createOpenCodeAdapter());
      }
    }

    return adapters;
  }

  private createAndWireCodexAdapter(
    dependencies: AgentRuntimeOwnerDependencies
  ): CodexAgentAdapter {
    const codexAdapter = new CodexAgentAdapter({
      appExecutable: dependencies.codexExecutablePath,
      appServerBaseEnvironment: dependencies.appServerBaseEnvironment,
      socketPath: dependencies.ipcSocketPath,
      invalidStreamEventsLogPath: dependencies.invalidStreamEventsLogPath,
      workspaceDir: dependencies.defaultWorkspacePath,
      userAgent: dependencies.userAgent,
      reconnectDelayMs: dependencies.ipcReconnectDelayMs,
      onStateChange: dependencies.onCodexStateChange
    });

    codexAdapter.onIpcFrame((event) => {
      this.handleCodexIpcFrame(dependencies, event);
    });
    this.codexAdapter = codexAdapter;

    return codexAdapter;
  }

  private createOpenCodeAdapter(): OpenCodeAgentAdapter {
    const openCodeAdapter = new OpenCodeAgentAdapter();
    this.openCodeAdapter = openCodeAdapter;
    return openCodeAdapter;
  }

  private handleCodexIpcFrame(
    dependencies: AgentRuntimeOwnerDependencies,
    event: CodexIpcFrameEvent
  ): void {
    // Consumers should always observe the raw frame before completion side effects are scheduled.
    dependencies.onCodexFrame(event);
    if (!shouldScheduleThreadStreamStateChanged(event)) {
      return;
    }
    dependencies.onThreadStreamStateChanged(event.threadId);
  }
}

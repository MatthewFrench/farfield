import type { Server } from "node:http";
import { AppServerTransportError } from "@farfield/api";
import { logger } from "./Logger.js";
import type { AgentRegistry } from "./Agents/Registry.js";
import type { AgentId } from "./Agents/Types.js";
import type { ActivityHistoryService } from "./ActivityHistoryService.js";
import type { ClientErrorStore } from "./ClientErrorStore.js";
import type { NtfyNotifier } from "./NtfyNotifier.js";
import type { OpenCodeAgentAdapter } from "./Agents/Adapters/OpencodeAgent.js";
import type { PushDispatchConcurrencyCoordinator } from "./Network/PushDispatchConcurrencyCoordinator.js";
import type { EventStreamClientRegistry } from "./Network/EventStreamClientRegistry.js";
import type { PushReceiptStore } from "./PushReceiptStore.js";
import type { PushService } from "./PushService.js";
import type { PushStore } from "./PushStore.js";

export interface ServerLifecycleCoordinatorDependencies {
  server: Server;
  host: string;
  port: number;
  appExecutablePath: string;
  socketPath: string;
  configuredAgentIds: AgentId[];
  pushEnabledConfigured: boolean;
  apiAuthRequired: boolean;
  pushStatePath: string;
  pushStatePathSource: string;
  pushReceiptsPath: string;
  pushSendsPath: string;
  pushReceiptsMaxCount: number;
  pushReceiptsMaxAgeDays: number;
  clientErrorMaxEntries: number;
  pushService: PushService;
  pushStore: PushStore;
  pushReceiptStore: PushReceiptStore;
  clientErrorStore: ClientErrorStore;
  ntfyNotifier: NtfyNotifier;
  registry: AgentRegistry;
  activityHistoryService: ActivityHistoryService;
  pushDispatchConcurrencyCoordinator: PushDispatchConcurrencyCoordinator;
  eventStreamClientRegistry: EventStreamClientRegistry;
  readOpenCodeAdapter: () => OpenCodeAgentAdapter | null;
  ensureTraceDirectory: () => void;
  pushSystem: (message: string, details?: Record<string, string | number | boolean | null>) => void;
  broadcastRuntimeState: () => void;
}

export class ServerLifecycleCoordinator {
  private readonly deps: ServerLifecycleCoordinatorDependencies;
  private isShutdownInProgress: boolean;

  public constructor(dependencies: ServerLifecycleCoordinatorDependencies) {
    this.deps = dependencies;
    this.isShutdownInProgress = false;
  }

  public isShuttingDown(): boolean {
    return this.isShutdownInProgress;
  }

  public isExpectedShutdownTransportError(error: Error): boolean {
    if (!this.isShutdownInProgress) {
      return false;
    }

    if (!(error instanceof AppServerTransportError)) {
      return false;
    }

    return (
      error.message === "app-server transport closed"
      || error.message.startsWith("app-server exited (")
    );
  }

  public async start(): Promise<void> {
    this.deps.ensureTraceDirectory();

    this.deps.pushSystem("Starting Farfield monitor server", {
      appExecutable: this.deps.appExecutablePath,
      socketPath: this.deps.socketPath,
      agentIds: this.deps.configuredAgentIds.join(",")
    });

    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error): void => {
        reject(error);
      };

      this.deps.server.once("error", onError);
      this.deps.server.listen(this.deps.port, this.deps.host, () => {
        this.deps.server.off("error", onError);
        resolve();
      });
    });

    this.deps.pushSystem("Monitor server ready", {
      url: `http://${this.deps.host}:${String(this.deps.port)}`,
      appExecutable: this.deps.appExecutablePath,
      socketPath: this.deps.socketPath,
      agentIds: this.deps.configuredAgentIds.join(",")
    });

    this.deps.pushSystem("Push subsystem ready", {
      enabled: this.deps.pushService.isEnabled(),
      configured: this.deps.pushEnabledConfigured,
      requiresAuth: this.deps.apiAuthRequired,
      authConfigured: this.deps.apiAuthRequired,
      statePath: this.deps.pushStatePath,
      statePathSource: this.deps.pushStatePathSource,
      receiptsPath: this.deps.pushReceiptsPath,
      sendsPath: this.deps.pushSendsPath,
      receiptsMaxCount: this.deps.pushReceiptsMaxCount,
      receiptsMaxAgeDays: this.deps.pushReceiptsMaxAgeDays,
      subscriptionCount: this.deps.pushStore.getSubscriptionCount(),
      watermarkCount: this.deps.pushStore.listCompletionWatermarks().length,
      receiptCount: this.deps.pushReceiptStore.getCount()
    });

    this.deps.pushSystem("Client error store ready", {
      sessionId: this.deps.clientErrorStore.getSessionId(),
      sessionLogPath: this.deps.clientErrorStore.getSessionLogPath(),
      maxEntries: this.deps.clientErrorMaxEntries
    });

    this.deps.pushSystem("ntfy notifier ready", this.deps.ntfyNotifier.getSummary());

    for (const adapter of this.deps.registry.listAdapters()) {
      try {
        await adapter.start();
        this.deps.pushSystem("Agent connected", {
          agentId: adapter.id,
          connected: adapter.isConnected()
        });

        if (adapter.id === "opencode") {
          const openCodeAdapter = this.deps.readOpenCodeAdapter();
          if (openCodeAdapter) {
            this.deps.pushSystem("OpenCode backend connected", {
              url: openCodeAdapter.getUrl()
            });
          }
        }
      } catch (error) {
        const errorMessage = this.errorMessageFromValue(error);
        this.deps.pushSystem("Agent failed to connect", {
          agentId: adapter.id,
          error: errorMessage
        });
        logger.error(
          {
            agentId: adapter.id,
            error: errorMessage
          },
          "agent-start-failed"
        );
      }
    }

    this.deps.broadcastRuntimeState();
    logger.info({ url: `http://${this.deps.host}:${String(this.deps.port)}` }, "monitor-server-ready");
  }

  public async shutdown(): Promise<void> {
    if (this.isShutdownInProgress) {
      return;
    }

    this.isShutdownInProgress = true;

    this.deps.activityHistoryService.closeActiveTraceIfPresent();

    this.deps.pushDispatchConcurrencyCoordinator.stop();
    this.deps.eventStreamClientRegistry.stopKeepalive();

    await this.deps.registry.stopAll();
    await new Promise<void>((resolve) => this.deps.server.close(() => resolve()));
  }

  public installSignalHandlers(): void {
    process.on("SIGINT", () => {
      void this.shutdown().then(() => process.exit(0));
    });

    process.on("SIGTERM", () => {
      void this.shutdown().then(() => process.exit(0));
    });
  }

  private errorMessageFromValue<ErrorValue>(error: ErrorValue): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === "string") {
      return error;
    }

    return String(error);
  }
}

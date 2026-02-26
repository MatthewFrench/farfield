import type { Server } from "node:http";
import { AppServerTransportError } from "@farfield/api";
import { logger } from "../../Shared/Logging/Logger.js";
import type { AgentRegistry } from "../../Agents/Registry.js";
import type { AgentId } from "../../Agents/Types.js";
import type { ActivityHistoryService } from "../../Modules/Activity/ActivityHistoryService.js";
import type { ClientErrorStore } from "../../Modules/Debugging/ClientErrorStore.js";
import type { NtfyNotifier } from "../../Modules/PushNotifications/NtfyNotifier.js";
import type { OpenCodeAgentAdapter } from "../../Agents/Adapters/OpenCodeAgentAdapter.js";
import type { PushDispatchConcurrencyCoordinator } from "../../Network/PushDispatchConcurrencyCoordinator.js";
import type { EventStreamClientRegistry } from "../../Network/EventStreamClientRegistry.js";
import type { PushReceiptStore } from "../../Modules/PushNotifications/PushReceiptStore.js";
import type { PushService } from "../../Modules/PushNotifications/PushService.js";
import type { PushStore } from "../../Modules/PushNotifications/PushStore.js";

const AppServerTransportClosedErrorMessage = "app-server transport closed";
const AppServerExitedErrorMessagePrefix = "app-server exited (";
const OpenCodeAgentIdentifier: AgentId = "opencode";
const ServerListenErrorEventName = "error";
const ServerUrlProtocol = "http";
const ConfiguredAgentIdentifierDelimiter = ",";
const AgentStartFailedLogMessage = "agent-start-failed";
const MonitorServerReadyLogMessage = "monitor-server-ready";
const GracefulShutdownSignals: readonly NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
const ProcessSuccessfulExitCode = 0;
const ServerLifecycleMessages = Object.freeze({
  agentConnected: "Agent connected",
  agentFailedToConnect: "Agent failed to connect",
  clientErrorStoreReady: "Client error store ready",
  monitorServerReady: "Monitor server ready",
  ntfyNotifierReady: "ntfy notifier ready",
  openCodeBackendConnected: "OpenCode backend connected",
  pushSubsystemReady: "Push subsystem ready",
  startingMonitorServer: "Starting Farfield monitor server"
});

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

// Owns monitor-server and adapter lifecycle ordering so startup and teardown stay deterministic.
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
      error.message === AppServerTransportClosedErrorMessage
      || error.message.startsWith(AppServerExitedErrorMessagePrefix)
    );
  }

  public async start(): Promise<void> {
    this.deps.ensureTraceDirectory();

    this.deps.pushSystem(ServerLifecycleMessages.startingMonitorServer, {
      appExecutable: this.deps.appExecutablePath,
      socketPath: this.deps.socketPath,
      agentIds: this.readConfiguredAgentIdentifierSummary()
    });

    await this.startMonitorServer();

    this.deps.pushSystem(ServerLifecycleMessages.monitorServerReady, {
      url: this.readServerUrl(),
      appExecutable: this.deps.appExecutablePath,
      socketPath: this.deps.socketPath,
      agentIds: this.readConfiguredAgentIdentifierSummary()
    });

    this.deps.pushSystem(ServerLifecycleMessages.pushSubsystemReady, {
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

    this.deps.pushSystem(ServerLifecycleMessages.clientErrorStoreReady, {
      sessionId: this.deps.clientErrorStore.getSessionId(),
      sessionLogPath: this.deps.clientErrorStore.getSessionLogPath(),
      maxEntries: this.deps.clientErrorMaxEntries
    });

    this.deps.pushSystem(ServerLifecycleMessages.ntfyNotifierReady, this.deps.ntfyNotifier.getSummary());

    for (const adapter of this.deps.registry.listAdapters()) {
      try {
        await adapter.start();
        this.deps.pushSystem(ServerLifecycleMessages.agentConnected, {
          agentId: adapter.id,
          connected: adapter.isConnected()
        });

        if (adapter.id === OpenCodeAgentIdentifier) {
          const openCodeAdapter = this.deps.readOpenCodeAdapter();
          if (openCodeAdapter) {
            this.deps.pushSystem(ServerLifecycleMessages.openCodeBackendConnected, {
              url: openCodeAdapter.getUrl()
            });
          }
        }
      } catch (error) {
        const errorMessage = this.errorMessageFromValue(error);
        this.deps.pushSystem(ServerLifecycleMessages.agentFailedToConnect, {
          agentId: adapter.id,
          error: errorMessage
        });
        logger.error(
          {
            agentId: adapter.id,
            error: errorMessage
          },
          AgentStartFailedLogMessage
        );
      }
    }

    this.deps.broadcastRuntimeState();
    logger.info({ url: this.readServerUrl() }, MonitorServerReadyLogMessage);
  }

  public async shutdown(): Promise<void> {
    if (this.isShutdownInProgress) {
      return;
    }

    // Mark shutdown state before async teardown so transport errors are classified deterministically.
    this.isShutdownInProgress = true;

    this.deps.activityHistoryService.closeActiveTraceIfPresent();

    // Stop background producers first so no new dispatch/keepalive work is queued during teardown.
    this.deps.pushDispatchConcurrencyCoordinator.stop();
    this.deps.eventStreamClientRegistry.stopKeepalive();

    await this.deps.registry.stopAll();
    await new Promise<void>((resolve) => this.deps.server.close(() => resolve()));
  }

  public installSignalHandlers(): void {
    for (const signal of GracefulShutdownSignals) {
      process.on(signal, () => {
        void this.shutdown().then(() => process.exit(ProcessSuccessfulExitCode));
      });
    }
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

  private readConfiguredAgentIdentifierSummary(): string {
    return this.deps.configuredAgentIds.join(ConfiguredAgentIdentifierDelimiter);
  }

  private readServerUrl(): string {
    return `${ServerUrlProtocol}://${this.deps.host}:${String(this.deps.port)}`;
  }

  private async startMonitorServer(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const onListenError = (error: Error): void => {
        reject(error);
      };

      // Keep a startup-scoped error listener until `listen` succeeds, then remove it.
      this.deps.server.once(ServerListenErrorEventName, onListenError);
      this.deps.server.listen(this.deps.port, this.deps.host, () => {
        this.deps.server.off(ServerListenErrorEventName, onListenError);
        resolve();
      });
    });
  }
}

import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AgentRegistry } from "../Source/Agents/Registry.js";
import type { AgentAdapter, AgentCapabilities, AgentId } from "../Source/Agents/Types.js";
import { ActivityHistoryService } from "../Source/ActivityHistoryService.js";
import { ClientErrorStore } from "../Source/ClientErrorStore.js";
import { EventStreamClientRegistry } from "../Source/Network/EventStreamClientRegistry.js";
import { NtfyNotifier } from "../Source/NtfyNotifier.js";
import { PushDispatchConcurrencyCoordinator } from "../Source/Network/PushDispatchConcurrencyCoordinator.js";
import { PushReceiptStore } from "../Source/PushReceiptStore.js";
import { PushService } from "../Source/PushService.js";
import { PushStore } from "../Source/PushStore.js";
import { ServerLifecycleCoordinator } from "../Source/ServerLifecycleCoordinator.js";

const temporaryDirectoryPaths: string[] = [];

function createTemporaryDirectory(): string {
  const temporaryDirectoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "farfield-lifecycle-"));
  temporaryDirectoryPaths.push(temporaryDirectoryPath);
  return temporaryDirectoryPath;
}

const defaultCapabilities: AgentCapabilities = {
  canListModels: false,
  canListCollaborationModes: false,
  canSetCollaborationMode: false,
  canSubmitUserInput: false,
  canReadLiveState: false,
  canReadStreamEvents: false
};

function createAdapter(
  id: AgentId,
  counters: { startCount: number; stopCount: number }
): AgentAdapter {
  return {
    id,
    label: id,
    capabilities: defaultCapabilities,
    async start(): Promise<void> {
      counters.startCount += 1;
    },
    async stop(): Promise<void> {
      counters.stopCount += 1;
    },
    isEnabled(): boolean {
      return true;
    },
    isConnected(): boolean {
      return true;
    },
    async listThreads(): Promise<never> {
      throw new Error("not used");
    },
    async createThread(): Promise<never> {
      throw new Error("not used");
    },
    async readThread(): Promise<never> {
      throw new Error("not used");
    },
    async sendMessage(): Promise<void> {
      throw new Error("not used");
    },
    async interrupt(): Promise<void> {
      throw new Error("not used");
    }
  };
}

afterEach(() => {
  for (const temporaryDirectoryPath of temporaryDirectoryPaths.splice(0)) {
    if (fs.existsSync(temporaryDirectoryPath)) {
      fs.rmSync(temporaryDirectoryPath, { recursive: true, force: true });
    }
  }
});

describe("ServerLifecycleCoordinator", () => {
  it("starts and stops server + adapters with owned lifecycle flow", async () => {
    const temporaryDirectoryPath = createTemporaryDirectory();
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
    });

    const adapterCounters = { startCount: 0, stopCount: 0 };
    const registry = new AgentRegistry([createAdapter("codex", adapterCounters)]);

    const eventStreamClientRegistry = new EventStreamClientRegistry(1_000);
    const activityHistoryService = new ActivityHistoryService(50, eventStreamClientRegistry);
    const pushDispatchConcurrencyCoordinator = new PushDispatchConcurrencyCoordinator(
      50,
      () => false,
      async () => {}
    );

    const pushStore = new PushStore(path.join(temporaryDirectoryPath, "push-state.json"));
    pushStore.load();
    const pushReceiptStore = new PushReceiptStore(path.join(temporaryDirectoryPath, "push-receipts.json"), 50, 86_400_000);
    pushReceiptStore.load();
    const pushService = new PushService({
      enabled: false,
      vapidPublicKey: "",
      vapidPrivateKey: "",
      vapidSubject: ""
    });
    const clientErrorStore = new ClientErrorStore(
      path.join(temporaryDirectoryPath, "client-errors.ndjson"),
      "session-test",
      100
    );
    const ntfyNotifier = new NtfyNotifier({
      enabled: false,
      topic: null,
      baseUrl: "https://ntfy.sh",
      bearerToken: null,
      priority: "3"
    });

    const lifecycleMessages: string[] = [];
    const coordinator = new ServerLifecycleCoordinator({
      server,
      host: "127.0.0.1",
      port: 0,
      appExecutablePath: "codex",
      socketPath: "/tmp/test.sock",
      configuredAgentIds: ["codex"],
      pushEnabledConfigured: false,
      apiAuthRequired: false,
      pushStatePath: path.join(temporaryDirectoryPath, "push-state.json"),
      pushStatePathSource: "env",
      pushReceiptsPath: path.join(temporaryDirectoryPath, "push-receipts.json"),
      pushSendsPath: path.join(temporaryDirectoryPath, "push-sends.json"),
      pushReceiptsMaxCount: 50,
      pushReceiptsMaxAgeDays: 1,
      clientErrorMaxEntries: 100,
      pushService,
      pushStore,
      pushReceiptStore,
      clientErrorStore,
      ntfyNotifier,
      registry,
      activityHistoryService,
      pushDispatchConcurrencyCoordinator,
      eventStreamClientRegistry,
      readOpenCodeAdapter: () => null,
      ensureTraceDirectory: () => {
        const traceDirectoryPath = path.join(temporaryDirectoryPath, "traces");
        if (!fs.existsSync(traceDirectoryPath)) {
          fs.mkdirSync(traceDirectoryPath, { recursive: true });
        }
      },
      pushSystem: (message) => {
        lifecycleMessages.push(message);
      },
      broadcastRuntimeState: () => {}
    });

    expect(coordinator.isShuttingDown()).toBe(false);
    await coordinator.start();
    expect(adapterCounters.startCount).toBe(1);
    expect(lifecycleMessages).toContain("Starting Farfield monitor server");
    expect(lifecycleMessages).toContain("Monitor server ready");

    await coordinator.shutdown();
    expect(coordinator.isShuttingDown()).toBe(true);
    expect(adapterCounters.stopCount).toBe(1);
  });
});

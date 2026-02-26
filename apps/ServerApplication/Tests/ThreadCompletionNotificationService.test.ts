import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import {
  parseThreadConversationState,
  type PushNotificationPayload,
  type StoredPushSubscription
} from "@farfield/protocol";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CodexAgentAdapter } from "../Source/Agents/Adapters/CodexAgentAdapter.js";
import { logger } from "../Source/Shared/Logging/Logger.js";
import { NtfyNotifier } from "../Source/Modules/PushNotifications/NtfyNotifier.js";
import { PushSendStore } from "../Source/Modules/PushNotifications/PushSendStore.js";
import { PushService } from "../Source/Modules/PushNotifications/PushService.js";
import { PushStore } from "../Source/Modules/PushNotifications/PushStore.js";
import { ThreadCompletionNotificationService } from "../Source/Modules/Threads/ThreadCompletionNotificationService.js";
import { ThreadConcurrencyCoordinator } from "../Source/Network/ThreadConcurrencyCoordinator.js";
import { PushMutationConcurrencyCoordinator } from "../Source/Network/PushMutationConcurrencyCoordinator.js";

const temporaryDirectoryPaths: string[] = [];

function createTemporaryDirectory(): string {
  const temporaryDirectoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "farfield-completion-service-"));
  temporaryDirectoryPaths.push(temporaryDirectoryPath);
  return temporaryDirectoryPath;
}

afterEach(() => {
  for (const temporaryDirectoryPath of temporaryDirectoryPaths.splice(0)) {
    if (fs.existsSync(temporaryDirectoryPath)) {
      fs.rmSync(temporaryDirectoryPath, { recursive: true, force: true });
    }
  }
});

class RecordingPushService extends PushService {
  public readonly calls: Array<{
    subscriptions: StoredPushSubscription[];
    payload: PushNotificationPayload;
  }> = [];

  public constructor() {
    super({
      enabled: false,
      vapidPublicKey: "",
      vapidPrivateKey: "",
      vapidSubject: ""
    });
  }

  public override isEnabled(): boolean {
    return true;
  }

  public override async sendToSubscriptions(
    subscriptions: StoredPushSubscription[],
    payload: PushNotificationPayload
  ): Promise<{
      attempted: number;
      delivered: number;
      failures: Array<{ endpoint: string; statusCode: number | null; message: string }>;
      prunedEndpoints: string[];
    }> {
    this.calls.push({
      subscriptions,
      payload
    });
    return {
      attempted: subscriptions.length,
      delivered: subscriptions.length,
      failures: [],
      prunedEndpoints: []
    };
  }
}

class FailingPushService extends PushService {
  public constructor() {
    super({
      enabled: false,
      vapidPublicKey: "",
      vapidPrivateKey: "",
      vapidSubject: ""
    });
  }

  public override isEnabled(): boolean {
    return true;
  }

  public override async sendToSubscriptions(
    subscriptions: StoredPushSubscription[],
    _payload: PushNotificationPayload
  ): Promise<{
      attempted: number;
      delivered: number;
      failures: Array<{ endpoint: string; statusCode: number | null; message: string }>;
      prunedEndpoints: string[];
    }> {
    return {
      attempted: subscriptions.length,
      delivered: 0,
      failures: subscriptions.map((subscription) => ({
        endpoint: subscription.subscription.endpoint,
        statusCode: 503,
        message: "Service unavailable"
      })),
      prunedEndpoints: []
    };
  }
}

const PushCompletionFailureLogSchema = z
  .object({
    threadId: z.string(),
    failureCount: z.number().int().nonnegative(),
    failureSamples: z.array(z.object({
      endpoint: z.string(),
      statusCode: z.union([z.number().int(), z.null()]),
      message: z.string()
    }).strict()),
    omittedFailureCount: z.number().int().nonnegative()
  })
  .strict();

describe("ThreadCompletionNotificationService", () => {
  it("does not schedule checks when ntfy and push are disabled", async () => {
    const temporaryDirectoryPath = createTemporaryDirectory();
    const pushStore = new PushStore(path.join(temporaryDirectoryPath, "push-state.json"));
    const pushSendStore = new PushSendStore(path.join(temporaryDirectoryPath, "push-send.json"));
    pushStore.load();
    pushSendStore.load();

    const pushService = new PushService({
      enabled: false,
      vapidPublicKey: "",
      vapidPrivateKey: "",
      vapidSubject: ""
    });
    const ntfyNotifier = new NtfyNotifier({
      enabled: false,
      topic: null,
      baseUrl: "https://ntfy.sh",
      bearerToken: null,
      priority: "3"
    });

    const pushSystemEvents: string[] = [];
    const service = new ThreadCompletionNotificationService({
      readCodexAdapter: () => null,
      threadConcurrencyCoordinator: new ThreadConcurrencyCoordinator(),
      pushMutationConcurrencyCoordinator: new PushMutationConcurrencyCoordinator(),
      ntfyNotifier,
      pushService,
      pushStore,
      pushSendStore,
      pushSystem: (message) => {
        pushSystemEvents.push(message);
      }
    });

    expect(service.shouldScheduleCompletionCheck()).toBe(false);
    await service.checkAndNotifyThreadCompletion("thread_1");
    expect(pushSystemEvents).toHaveLength(0);
  });

  it("schedules checks when ntfy is enabled", async () => {
    const temporaryDirectoryPath = createTemporaryDirectory();
    const pushStore = new PushStore(path.join(temporaryDirectoryPath, "push-state.json"));
    const pushSendStore = new PushSendStore(path.join(temporaryDirectoryPath, "push-send.json"));
    pushStore.load();
    pushSendStore.load();

    const pushService = new PushService({
      enabled: false,
      vapidPublicKey: "",
      vapidPrivateKey: "",
      vapidSubject: ""
    });
    const ntfyNotifier = new NtfyNotifier({
      enabled: true,
      topic: "farfield-tests",
      baseUrl: "https://ntfy.sh",
      bearerToken: null,
      priority: "3"
    });

    const service = new ThreadCompletionNotificationService({
      readCodexAdapter: () => null,
      threadConcurrencyCoordinator: new ThreadConcurrencyCoordinator(),
      pushMutationConcurrencyCoordinator: new PushMutationConcurrencyCoordinator(),
      ntfyNotifier,
      pushService,
      pushStore,
      pushSendStore,
      pushSystem: () => {}
    });

    expect(service.shouldScheduleCompletionCheck()).toBe(true);
    await service.checkAndNotifyThreadCompletion("thread_1");
  });

  it("partitions completion push payloads by subscription privacy mode", async () => {
    const temporaryDirectoryPath = createTemporaryDirectory();
    const pushStore = new PushStore(path.join(temporaryDirectoryPath, "push-state.json"));
    const pushSendStore = new PushSendStore(path.join(temporaryDirectoryPath, "push-send.json"));
    pushStore.load();
    pushSendStore.load();

    await pushStore.upsertSubscription(
      {
        endpoint: "https://push.example.test/subscriptions/private",
        keys: {
          p256dh: "private_key",
          auth: "private_auth"
        }
      },
      {
        privateMode: true
      }
    );
    await pushStore.upsertSubscription(
      {
        endpoint: "https://push.example.test/subscriptions/detailed",
        keys: {
          p256dh: "detailed_key",
          auth: "detailed_auth"
        }
      },
      {
        privateMode: false
      }
    );

    const conversationState = parseThreadConversationState({
      id: "thread_1",
      preview: "Thread preview",
      turns: [
        {
          turnId: "turn_1",
          status: "completed",
          items: [
            {
              id: "item_agent_1",
              type: "agentMessage",
              text: "Detailed completion text for subscribers"
            }
          ]
        }
      ],
      requests: []
    });

    const codexAdapter = {
      readLiveState: async (_threadId: string) => ({
        ownerClientId: null,
        conversationState,
        liveStateError: null
      })
    } as CodexAgentAdapter;

    const recordingPushService = new RecordingPushService();
    const ntfyNotifier = new NtfyNotifier({
      enabled: false,
      topic: null,
      baseUrl: "https://ntfy.sh",
      bearerToken: null,
      priority: "3"
    });

    const pushSystemEvents: string[] = [];
    const service = new ThreadCompletionNotificationService({
      readCodexAdapter: () => codexAdapter,
      threadConcurrencyCoordinator: new ThreadConcurrencyCoordinator(),
      pushMutationConcurrencyCoordinator: new PushMutationConcurrencyCoordinator(),
      ntfyNotifier,
      pushService: recordingPushService,
      pushStore,
      pushSendStore,
      pushSystem: (message) => {
        pushSystemEvents.push(message);
      }
    });

    await service.checkAndNotifyThreadCompletion("thread_1");

    expect(recordingPushService.calls).toHaveLength(2);
    const privateCall = recordingPushService.calls.find((call) =>
      call.subscriptions.every((subscription) => subscription.settings.privateMode)
    );
    const detailedCall = recordingPushService.calls.find((call) =>
      call.subscriptions.every((subscription) => !subscription.settings.privateMode)
    );
    expect(privateCall).toBeDefined();
    expect(detailedCall).toBeDefined();
    if (!privateCall || !detailedCall) {
      throw new Error("Expected private and detailed push calls");
    }

    expect(privateCall.payload.title).toBe("Farfield thread completed");
    expect(privateCall.payload.body).toBe("A response is ready in Farfield.");
    expect(detailedCall.payload.title).toBe("Thread preview");
    expect(detailedCall.payload.body).toContain("Detailed completion text");
    expect(privateCall.payload.notificationId).toBe(detailedCall.payload.notificationId);

    const latestSend = pushSendStore.getLatest();
    expect(latestSend).not.toBeNull();
    if (!latestSend) {
      throw new Error("Expected latest push send summary");
    }
    expect(latestSend.attempted).toBe(2);
    expect(latestSend.delivered).toBe(2);
    expect(latestSend.failures).toBe(0);
    expect(latestSend.notificationId).toBe(privateCall.payload.notificationId);

    expect(pushStore.getCompletionWatermark("thread_1")).not.toBeNull();
    expect(pushSystemEvents).toContain("thread completion notification sent");
  });

  it("logs bounded failure samples when push dispatch returns many failures", async () => {
    const temporaryDirectoryPath = createTemporaryDirectory();
    const pushStore = new PushStore(path.join(temporaryDirectoryPath, "push-state.json"));
    const pushSendStore = new PushSendStore(path.join(temporaryDirectoryPath, "push-send.json"));
    pushStore.load();
    pushSendStore.load();

    for (let index = 0; index < 14; index += 1) {
      await pushStore.upsertSubscription(
        {
          endpoint: `https://push.example.test/subscriptions/fail_${String(index)}`,
          keys: {
            p256dh: `key_${String(index)}`,
            auth: `auth_${String(index)}`
          }
        },
        {
          privateMode: false
        }
      );
    }

    const conversationState = parseThreadConversationState({
      id: "thread_many_failures",
      preview: "Failure preview",
      turns: [
        {
          turnId: "turn_many_failures",
          status: "completed",
          items: [
            {
              id: "item_agent_many_failures",
              type: "agentMessage",
              text: "failure body"
            }
          ]
        }
      ],
      requests: []
    });

    const codexAdapter = {
      readLiveState: async (_threadId: string) => ({
        ownerClientId: null,
        conversationState,
        liveStateError: null
      })
    } as CodexAgentAdapter;

    const warningSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    try {
      const service = new ThreadCompletionNotificationService({
        readCodexAdapter: () => codexAdapter,
        threadConcurrencyCoordinator: new ThreadConcurrencyCoordinator(),
        pushMutationConcurrencyCoordinator: new PushMutationConcurrencyCoordinator(),
        ntfyNotifier: new NtfyNotifier({
          enabled: false,
          topic: null,
          baseUrl: "https://ntfy.sh",
          bearerToken: null,
          priority: "3"
        }),
        pushService: new FailingPushService(),
        pushStore,
        pushSendStore,
        pushSystem: () => {}
      });

      await service.checkAndNotifyThreadCompletion("thread_many_failures");

      const boundedFailureWarning = warningSpy.mock.calls.find(
        (call) => call[1] === "push-completion-send-failed"
      );
      expect(boundedFailureWarning).toBeDefined();
      if (!boundedFailureWarning) {
        throw new Error("Expected push-completion-send-failed warning");
      }

      const parsedWarning = PushCompletionFailureLogSchema.parse(boundedFailureWarning[0]);
      expect(parsedWarning.threadId).toBe("thread_many_failures");
      expect(parsedWarning.failureCount).toBe(14);
      expect(parsedWarning.failureSamples.length).toBe(10);
      expect(parsedWarning.omittedFailureCount).toBe(4);
    } finally {
      warningSpy.mockRestore();
    }
  });
});

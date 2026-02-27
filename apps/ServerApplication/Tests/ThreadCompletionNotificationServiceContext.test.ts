import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseThreadConversationState } from "@farfield/protocol";
import { afterEach, describe, expect, it } from "vitest";
import type { CodexAgentAdapter } from "../Source/Agents/Adapters/CodexAgentAdapter.js";
import {
  NtfyNotifier,
  type NtfyThreadCompletedPayload,
} from "../Source/Modules/PushNotifications/NtfyNotifier.js";
import { PushSendStore } from "../Source/Modules/PushNotifications/PushSendStore.js";
import { PushService } from "../Source/Modules/PushNotifications/PushService.js";
import { PushStore } from "../Source/Modules/PushNotifications/PushStore.js";
import { ThreadCompletionNotificationService } from "../Source/Modules/Threads/ThreadCompletionNotificationService.js";
import { PushMutationConcurrencyCoordinator } from "../Source/Network/PushMutationConcurrencyCoordinator.js";
import { ThreadConcurrencyCoordinator } from "../Source/Network/ThreadConcurrencyCoordinator.js";

const temporaryDirectoryPaths: string[] = [];

function createTemporaryDirectory(): string {
  const temporaryDirectoryPath = fs.mkdtempSync(
    path.join(os.tmpdir(), "farfield-completion-context-"),
  );
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

class RecordingNtfyNotifier extends NtfyNotifier {
  public readonly calls: NtfyThreadCompletedPayload[] = [];

  public constructor() {
    super({
      enabled: true,
      topic: "farfield-tests",
      baseUrl: "https://ntfy.sh",
      bearerToken: null,
      priority: "3",
    });
  }

  public override isEnabled(): boolean {
    return true;
  }

  public override async publishThreadCompleted(
    payload: NtfyThreadCompletedPayload,
  ): Promise<{ messageId: string | null }> {
    this.calls.push(payload);
    return {
      messageId: "message_recorded",
    };
  }
}

describe("ThreadCompletionNotificationServiceContext", () => {
  it("does not commit completion watermark when completion exists but no notification channel is enabled", async () => {
    const temporaryDirectoryPath = createTemporaryDirectory();
    const pushStore = new PushStore(path.join(temporaryDirectoryPath, "push-state.json"));
    const pushSendStore = new PushSendStore(path.join(temporaryDirectoryPath, "push-send.json"));
    pushStore.load();
    pushSendStore.load();

    const conversationState = parseThreadConversationState({
      id: "thread_no_targets",
      preview: "No targets preview",
      turns: [
        {
          turnId: "turn_no_targets",
          status: "completed",
          items: [
            {
              id: "item_agent_no_targets",
              type: "agentMessage",
              text: "No channel is enabled",
            },
          ],
        },
      ],
      requests: [],
    });

    const codexAdapter = {
      readLiveState: async (_threadId: string) => ({
        ownerClientId: null,
        conversationState,
        liveStateError: null,
      }),
    } as CodexAgentAdapter;

    const pushSystemEvents: string[] = [];
    const service = new ThreadCompletionNotificationService({
      readCodexAdapter: () => codexAdapter,
      threadConcurrencyCoordinator: new ThreadConcurrencyCoordinator(),
      pushMutationConcurrencyCoordinator: new PushMutationConcurrencyCoordinator(),
      ntfyNotifier: new NtfyNotifier({
        enabled: false,
        topic: null,
        baseUrl: "https://ntfy.sh",
        bearerToken: null,
        priority: "3",
      }),
      pushService: new PushService({
        enabled: false,
        vapidPublicKey: "",
        vapidPrivateKey: "",
        vapidSubject: "",
      }),
      pushStore,
      pushSendStore,
      pushSystem: (message) => {
        pushSystemEvents.push(message);
      },
    });

    await service.checkAndNotifyThreadCompletion("thread_no_targets");

    expect(pushStore.getCompletionWatermark("thread_no_targets")).toBeNull();
    expect(pushSendStore.getLatest()).toBeNull();
    expect(pushSystemEvents).toHaveLength(0);
  });

  it("uses preview and cwd with higher priority when building ntfy completion context", async () => {
    const temporaryDirectoryPath = createTemporaryDirectory();
    const pushStore = new PushStore(path.join(temporaryDirectoryPath, "push-state.json"));
    const pushSendStore = new PushSendStore(path.join(temporaryDirectoryPath, "push-send.json"));
    pushStore.load();
    pushSendStore.load();

    const conversationState = parseThreadConversationState({
      id: "thread_context_preview_cwd",
      preview: "  Build finished  ",
      title: "  Backup title  ",
      cwd: "C:\\Users\\matthew\\Workspace\\RocketProject\\",
      turns: [
        {
          turnId: "turn_context_preview_cwd",
          status: "completed",
          items: [
            {
              id: "item_agent_context_preview_cwd",
              type: "agentMessage",
              text: "Delivered over ntfy",
            },
          ],
        },
      ],
      requests: [],
    });

    const codexAdapter = {
      readLiveState: async (_threadId: string) => ({
        ownerClientId: null,
        conversationState,
        liveStateError: null,
      }),
    } as CodexAgentAdapter;

    const recordingNtfyNotifier = new RecordingNtfyNotifier();
    const service = new ThreadCompletionNotificationService({
      readCodexAdapter: () => codexAdapter,
      threadConcurrencyCoordinator: new ThreadConcurrencyCoordinator(),
      pushMutationConcurrencyCoordinator: new PushMutationConcurrencyCoordinator(),
      ntfyNotifier: recordingNtfyNotifier,
      pushService: new PushService({
        enabled: false,
        vapidPublicKey: "",
        vapidPrivateKey: "",
        vapidSubject: "",
      }),
      pushStore,
      pushSendStore,
      pushSystem: () => {},
    });

    await service.checkAndNotifyThreadCompletion("thread_context_preview_cwd");

    expect(recordingNtfyNotifier.calls).toHaveLength(1);
    expect(recordingNtfyNotifier.calls[0]).toMatchObject({
      threadId: "thread_context_preview_cwd",
      preview: "Build finished",
      threadName: "Build finished",
      projectName: "RocketProject",
    });
    expect(pushStore.getCompletionWatermark("thread_context_preview_cwd")).not.toBeNull();
  });

  it("uses title and path when preview and cwd are empty in ntfy completion context", async () => {
    const temporaryDirectoryPath = createTemporaryDirectory();
    const pushStore = new PushStore(path.join(temporaryDirectoryPath, "push-state.json"));
    const pushSendStore = new PushSendStore(path.join(temporaryDirectoryPath, "push-send.json"));
    pushStore.load();
    pushSendStore.load();

    const conversationState = parseThreadConversationState({
      id: "thread_context_title_path",
      preview: "   ",
      title: "  Secondary title  ",
      path: "/Users/matthew/Workspace/AtlasProject//",
      turns: [
        {
          turnId: "turn_context_title_path",
          status: "completed",
          items: [
            {
              id: "item_agent_context_title_path",
              type: "agentMessage",
              text: "Delivered over ntfy",
            },
          ],
        },
      ],
      requests: [],
    });

    const codexAdapter = {
      readLiveState: async (_threadId: string) => ({
        ownerClientId: null,
        conversationState,
        liveStateError: null,
      }),
    } as CodexAgentAdapter;

    const recordingNtfyNotifier = new RecordingNtfyNotifier();
    const service = new ThreadCompletionNotificationService({
      readCodexAdapter: () => codexAdapter,
      threadConcurrencyCoordinator: new ThreadConcurrencyCoordinator(),
      pushMutationConcurrencyCoordinator: new PushMutationConcurrencyCoordinator(),
      ntfyNotifier: recordingNtfyNotifier,
      pushService: new PushService({
        enabled: false,
        vapidPublicKey: "",
        vapidPrivateKey: "",
        vapidSubject: "",
      }),
      pushStore,
      pushSendStore,
      pushSystem: () => {},
    });

    await service.checkAndNotifyThreadCompletion("thread_context_title_path");

    expect(recordingNtfyNotifier.calls).toHaveLength(1);
    expect(recordingNtfyNotifier.calls[0]).toMatchObject({
      threadId: "thread_context_title_path",
      preview: "",
      threadName: "Secondary title",
      projectName: "AtlasProject",
    });
    expect(pushStore.getCompletionWatermark("thread_context_title_path")).not.toBeNull();
  });
});

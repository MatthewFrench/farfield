import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { PushNotificationPayload, StoredPushSubscription } from "@farfield/protocol";
import { CompletionDetector } from "./CompletionDetector.js";
import { logger } from "../../Shared/Logging/Logger.js";
import type { CodexAgentAdapter } from "../../Agents/Adapters/CodexAgentAdapter.js";
import type { AgentThreadLiveState } from "../../Agents/Types.js";
import type { NtfyNotifier } from "../PushNotifications/NtfyNotifier.js";
import type { PushSendStore } from "../PushNotifications/PushSendStore.js";
import type { PushService } from "../PushNotifications/PushService.js";
import type { PushStore } from "../PushNotifications/PushStore.js";
import type { ThreadConcurrencyCoordinator } from "../../Network/ThreadConcurrencyCoordinator.js";
import type { PushMutationConcurrencyCoordinator } from "../../Network/PushMutationConcurrencyCoordinator.js";

type CompletionNotificationContext = {
  preview: string;
  threadName: string;
  projectName: string;
};

const ThreadNotificationContextSchema = z
  .object({
    preview: z.string().optional(),
    title: z.union([z.string(), z.null()]).optional(),
    cwd: z.string().optional(),
    path: z.string().optional()
  })
  .passthrough();

export interface ThreadCompletionNotificationServiceDependencies {
  readCodexAdapter: () => CodexAgentAdapter | null;
  threadConcurrencyCoordinator: ThreadConcurrencyCoordinator;
  pushMutationConcurrencyCoordinator: PushMutationConcurrencyCoordinator;
  ntfyNotifier: NtfyNotifier;
  pushService: PushService;
  pushStore: PushStore;
  pushSendStore: PushSendStore;
  pushSystem: (message: string, details?: Record<string, string | number | boolean | null>) => void;
}

interface CompletionPushSendAggregate {
  notificationId: string;
  sentAt: string;
  attempted: number;
  delivered: number;
  failures: number;
  failureDetails: Array<{ endpoint: string; statusCode: number | null; message: string }>;
  prunedEndpoints: string[];
}

export class ThreadCompletionNotificationService {
  private readonly readCodexAdapter: () => CodexAgentAdapter | null;
  private readonly threadConcurrencyCoordinator: ThreadConcurrencyCoordinator;
  private readonly pushMutationConcurrencyCoordinator: PushMutationConcurrencyCoordinator;
  private readonly ntfyNotifier: NtfyNotifier;
  private readonly pushService: PushService;
  private readonly pushStore: PushStore;
  private readonly pushSendStore: PushSendStore;
  private readonly pushSystem: (message: string, details?: Record<string, string | number | boolean | null>) => void;
  private readonly completionDetector: CompletionDetector;

  public constructor(deps: ThreadCompletionNotificationServiceDependencies) {
    this.readCodexAdapter = deps.readCodexAdapter;
    this.threadConcurrencyCoordinator = deps.threadConcurrencyCoordinator;
    this.pushMutationConcurrencyCoordinator = deps.pushMutationConcurrencyCoordinator;
    this.ntfyNotifier = deps.ntfyNotifier;
    this.pushService = deps.pushService;
    this.pushStore = deps.pushStore;
    this.pushSendStore = deps.pushSendStore;
    this.pushSystem = deps.pushSystem;

    const completionWatermarks = new Map<string, string>();
    for (const entry of this.pushStore.listCompletionWatermarks()) {
      completionWatermarks.set(entry.threadId, entry.marker);
    }
    this.completionDetector = new CompletionDetector(completionWatermarks);
  }

  public shouldScheduleCompletionCheck(): boolean {
    return this.ntfyNotifier.isEnabled()
      || (this.pushService.isEnabled() && this.pushStore.getSubscriptionCount() > 0);
  }

  public async checkAndNotifyThreadCompletion(threadId: string): Promise<void> {
    // Completion reads must share the same per-thread ownership lane as thread
    // mutation routes to prevent notification checks from observing half-applied state.
    await this.threadConcurrencyCoordinator.runExclusive(threadId, async () => {
      await this.checkAndNotifyThreadCompletionUnderThreadLock(threadId);
    });
  }

  private async checkAndNotifyThreadCompletionUnderThreadLock(threadId: string): Promise<void> {
    const codexAdapter = this.readCodexAdapter();
    if (!codexAdapter) {
      return;
    }

    try {
      const liveState = await codexAdapter.readLiveState(threadId);
      const completionCandidate = this.completionDetector.detect(threadId, liveState.conversationState);
      if (!completionCandidate) {
        return;
      }

      const hasNtfyTarget = this.ntfyNotifier.isEnabled();
      const subscriptions = this.pushService.isEnabled()
        ? await this.pushMutationConcurrencyCoordinator.runExclusive(async () => this.pushStore.listSubscriptions())
        : [];
      const hasWebPushTarget = subscriptions.length > 0;
      if (!hasNtfyTarget && !hasWebPushTarget) {
        return;
      }

      const context = this.readThreadNotificationContext(liveState.conversationState);

      let ntfyDelivered = false;
      let ntfyMessageId: string | null = null;
      if (hasNtfyTarget) {
        try {
          const publishResult = await this.ntfyNotifier.publishThreadCompleted({
            threadId: completionCandidate.threadId,
            preview: context.preview,
            projectName: context.projectName,
            threadName: context.threadName,
            agentText: completionCandidate.agentText
          });
          ntfyDelivered = true;
          ntfyMessageId = publishResult.messageId;
        } catch (error) {
          logger.warn(
            {
              threadId,
              error: this.errorMessageFromValue(error)
            },
            "ntfy-publish-failed"
          );
        }
      }

      let webPushAttempted = 0;
      let webPushDelivered = 0;
      let webPushFailures = 0;
      if (hasWebPushTarget) {
        const sendAggregate = await this.sendCompletionPushNotifications({
          subscriptions,
          threadId: completionCandidate.threadId,
          turnId: completionCandidate.turnId,
          preview: context.preview,
          agentText: completionCandidate.agentText
        });

        webPushAttempted = sendAggregate.attempted;
        webPushDelivered = sendAggregate.delivered;
        webPushFailures = sendAggregate.failures;

        await this.pushMutationConcurrencyCoordinator.runExclusive(async () => {
          await Promise.all(
            sendAggregate.prunedEndpoints.map(async (endpoint) => this.pushStore.removeSubscriptionByEndpoint(endpoint))
          );

          if (sendAggregate.attempted > 0) {
            this.pushSendStore.setLatest({
              notificationId: sendAggregate.notificationId,
              threadId: completionCandidate.threadId,
              turnId: completionCandidate.turnId,
              sentAt: sendAggregate.sentAt,
              attempted: sendAggregate.attempted,
              delivered: sendAggregate.delivered,
              failures: sendAggregate.failures
            });
          }
        });

        if (sendAggregate.failureDetails.length > 0) {
          logger.warn(
            {
              threadId,
              failures: sendAggregate.failureDetails
            },
            "push-completion-send-failed"
          );
        }
      }

      if (!ntfyDelivered && webPushDelivered === 0) {
        return;
      }

      await this.pushMutationConcurrencyCoordinator.runExclusive(async () => {
        await this.pushStore.setCompletionWatermark(threadId, completionCandidate.marker);
      });
      this.completionDetector.commit(threadId, completionCandidate.marker);
      this.pushSystem("thread completion notification sent", {
        threadId,
        ntfyDelivered,
        ...(ntfyMessageId ? { ntfyMessageId } : {}),
        webPushAttempted,
        webPushDelivered,
        webPushFailures
      });
    } catch (error) {
      logger.warn(
        {
          threadId,
          error: this.errorMessageFromValue(error)
        },
        "completion-notification-check-failed"
      );
    }
  }

  private buildThreadCompletionPushPayload(input: {
    notificationId: string;
    sentAt: string;
    threadId: string;
    turnId: string;
    preview: string;
    agentText: string;
    privateMode: boolean;
  }): PushNotificationPayload {
    const url = `/threads/${encodeURIComponent(input.threadId)}`;

    const title = input.privateMode
      ? "Farfield thread completed"
      : (() => {
        const candidate = this.trimNotificationText(input.preview, 120);
        return candidate.length > 0 ? candidate : "Farfield thread completed";
      })();

    const body = input.privateMode
      ? "A response is ready in Farfield."
      : (() => {
        const candidate = this.trimNotificationText(input.agentText, 320);
        return candidate.length > 0 ? candidate : "A response is ready in Farfield.";
      })();

    return {
      notificationId: input.notificationId,
      title,
      body,
      threadId: input.threadId,
      turnId: input.turnId,
      url,
      createdAt: input.sentAt,
      web_push: {
        notification: {
          title,
          body,
          navigate: url,
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          tag: `thread:${input.threadId}`
        }
      }
    };
  }

  private async sendCompletionPushNotifications(input: {
    subscriptions: StoredPushSubscription[];
    threadId: string;
    turnId: string;
    preview: string;
    agentText: string;
  }): Promise<CompletionPushSendAggregate> {
    const notificationId = `notif_${randomUUID()}`;
    const sentAt = new Date().toISOString();
    const privateModeSubscriptions = input.subscriptions.filter((subscription) => subscription.settings.privateMode);
    const detailedModeSubscriptions = input.subscriptions.filter((subscription) => !subscription.settings.privateMode);

    let attempted = 0;
    let delivered = 0;
    let failures = 0;
    const failureDetails: Array<{ endpoint: string; statusCode: number | null; message: string }> = [];
    const prunedEndpointSet = new Set<string>();

    const dispatchByPrivacyMode = async (
      subscriptions: StoredPushSubscription[],
      privateMode: boolean
    ): Promise<void> => {
      if (subscriptions.length === 0) {
        return;
      }

      const payload = this.buildThreadCompletionPushPayload({
        notificationId,
        sentAt,
        threadId: input.threadId,
        turnId: input.turnId,
        preview: input.preview,
        agentText: input.agentText,
        privateMode
      });

      try {
        const sendResult = await this.pushService.sendToSubscriptions(subscriptions, payload);
        attempted += sendResult.attempted;
        delivered += sendResult.delivered;
        failures += sendResult.failures.length;
        for (const failure of sendResult.failures) {
          failureDetails.push(failure);
        }
        for (const endpoint of sendResult.prunedEndpoints) {
          prunedEndpointSet.add(endpoint);
        }
      } catch (error) {
        logger.warn(
          {
            threadId: input.threadId,
            error: this.errorMessageFromValue(error),
            privateMode
          },
          "push-completion-send-threw"
        );
      }
    };

    await dispatchByPrivacyMode(privateModeSubscriptions, true);
    await dispatchByPrivacyMode(detailedModeSubscriptions, false);

    return {
      notificationId,
      sentAt,
      attempted,
      delivered,
      failures,
      failureDetails,
      prunedEndpoints: Array.from(prunedEndpointSet)
    };
  }

  private trimNotificationText(value: string, maxLength: number): string {
    const normalized = value.trim().replace(/\s+/g, " ");
    if (normalized.length <= maxLength) {
      return normalized;
    }
    return `${normalized.slice(0, maxLength - 3)}...`;
  }

  private readThreadNotificationContext(
    value: AgentThreadLiveState["conversationState"]
  ): CompletionNotificationContext {
    const parsed = ThreadNotificationContextSchema.safeParse(value);
    if (!parsed.success) {
      return {
        preview: "",
        threadName: "",
        projectName: "No project"
      };
    }

    const preview = this.normalizeOptionalString(parsed.data.preview ?? null) ?? "";
    const title = this.normalizeOptionalString(parsed.data.title ?? null) ?? "";
    const cwd = this.normalizeOptionalString(parsed.data.cwd ?? null);
    const pathValue = this.normalizeOptionalString(parsed.data.path ?? null);

    return {
      preview,
      threadName: preview.length > 0 ? preview : title,
      projectName: cwd
        ? this.projectLabelFromPath(cwd)
        : (pathValue ? this.projectLabelFromPath(pathValue) : "No project")
    };
  }

  private normalizeOptionalString(value: string | null): string | null {
    if (!value) {
      return null;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private projectLabelFromPath(value: string): string {
    const normalized = this.normalizeProjectPathForLabel(value);
    if (normalized.length === 0) {
      return "No project";
    }
    const segments = normalized.split("/").filter((segment) => segment.length > 0);
    return segments[segments.length - 1] ?? normalized;
  }

  private normalizeProjectPathForLabel(value: string): string {
    return value.trim().replaceAll("\\", "/").replace(/\/+$/, "");
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

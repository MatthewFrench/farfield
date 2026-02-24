import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { PushNotificationPayload } from "@farfield/protocol";
import { CompletionDetector } from "./CompletionDetector.js";
import { logger } from "./Logger.js";
import type { CodexAgentAdapter } from "./Agents/Adapters/CodexAgentAdapter.js";
import type { AgentThreadLiveState } from "./Agents/Types.js";
import type { NtfyNotifier } from "./NtfyNotifier.js";
import type { PushSendStore } from "./PushSendStore.js";
import type { PushService } from "./PushService.js";
import type { PushStore } from "./PushStore.js";

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
  ntfyNotifier: NtfyNotifier;
  pushService: PushService;
  pushStore: PushStore;
  pushSendStore: PushSendStore;
  pushSystem: (message: string, details?: Record<string, string | number | boolean | null>) => void;
}

export class ThreadCompletionNotificationService {
  private readonly readCodexAdapter: () => CodexAgentAdapter | null;
  private readonly ntfyNotifier: NtfyNotifier;
  private readonly pushService: PushService;
  private readonly pushStore: PushStore;
  private readonly pushSendStore: PushSendStore;
  private readonly pushSystem: (message: string, details?: Record<string, string | number | boolean | null>) => void;
  private readonly completionDetector: CompletionDetector;

  public constructor(deps: ThreadCompletionNotificationServiceDependencies) {
    this.readCodexAdapter = deps.readCodexAdapter;
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
      const subscriptions = this.pushService.isEnabled() ? this.pushStore.listSubscriptions() : [];
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
        const payload = this.buildThreadCompletionPushPayload({
          threadId: completionCandidate.threadId,
          turnId: completionCandidate.turnId,
          preview: context.preview,
          agentText: completionCandidate.agentText,
          privateMode: subscriptions.some((subscription) => subscription.settings.privateMode)
        });

        try {
          const sendResult = await this.pushService.sendToSubscriptions(subscriptions, payload);
          webPushAttempted = sendResult.attempted;
          webPushDelivered = sendResult.delivered;
          webPushFailures = sendResult.failures.length;

          for (const endpoint of sendResult.prunedEndpoints) {
            this.pushStore.removeSubscriptionByEndpoint(endpoint);
          }

          this.pushSendStore.setLatest({
            notificationId: payload.notificationId,
            threadId: completionCandidate.threadId,
            turnId: completionCandidate.turnId,
            sentAt: payload.createdAt,
            attempted: sendResult.attempted,
            delivered: sendResult.delivered,
            failures: sendResult.failures.length
          });

          if (sendResult.failures.length > 0) {
            logger.warn(
              {
                threadId,
                failures: sendResult.failures
              },
              "push-completion-send-failed"
            );
          }
        } catch (error) {
          logger.warn(
            {
              threadId,
              error: this.errorMessageFromValue(error)
            },
            "push-completion-send-threw"
          );
        }
      }

      if (!ntfyDelivered && webPushDelivered === 0) {
        return;
      }

      this.pushStore.setCompletionWatermark(threadId, completionCandidate.marker);
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
    threadId: string;
    turnId: string;
    preview: string;
    agentText: string;
    privateMode: boolean;
  }): PushNotificationPayload {
    const createdAt = new Date().toISOString();
    const notificationId = `notif_${randomUUID()}`;
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
      notificationId,
      title,
      body,
      threadId: input.threadId,
      turnId: input.turnId,
      url,
      createdAt,
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

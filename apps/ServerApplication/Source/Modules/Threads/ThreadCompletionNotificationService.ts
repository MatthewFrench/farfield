import { randomUUID } from "node:crypto";
import type { PushNotificationPayload, StoredPushSubscription } from "@farfield/protocol";
import { z } from "zod";
import type { CodexAgentAdapter } from "../../Agents/Adapters/CodexAgentAdapter.js";
import type { AgentThreadLiveState } from "../../Agents/Types.js";
import type { PushMutationConcurrencyCoordinator } from "../../Network/PushMutationConcurrencyCoordinator.js";
import type { ThreadConcurrencyCoordinator } from "../../Network/ThreadConcurrencyCoordinator.js";
import { logger } from "../../Shared/Logging/Logger.js";
import type { NtfyNotifier } from "../PushNotifications/NtfyNotifier.js";
import type { PushSendStore } from "../PushNotifications/PushSendStore.js";
import type { PushService } from "../PushNotifications/PushService.js";
import type { PushStore } from "../PushNotifications/PushStore.js";
import { type CompletionCandidate, CompletionDetector } from "./CompletionDetector.js";

type CompletionNotificationContext = {
  preview: string;
  threadName: string;
  projectName: string;
};

const DEFAULT_THREAD_NOTIFICATION_PREVIEW = "";
const DEFAULT_THREAD_NOTIFICATION_NAME = "";
const DEFAULT_PROJECT_NAME = "No project";
const THREAD_COMPLETION_PUSH_SYSTEM_OPERATION_NAME = "thread completion notification sent";
const THREAD_ROUTE_PREFIX = "/threads/";
const WEB_PUSH_NOTIFICATION_IDENTIFIER_PREFIX = "notif_";
const WEB_PUSH_NOTIFICATION_TAG_PREFIX = "thread:";
const WEB_PUSH_NOTIFICATION_ICON_PATH = "/icons/icon-192.png";
const WEB_PUSH_DEFAULT_TITLE = "Farfield thread completed";
const WEB_PUSH_DEFAULT_BODY = "A response is ready in Farfield.";
const WEB_PUSH_TITLE_MAX_LENGTH = 120;
const WEB_PUSH_BODY_MAX_LENGTH = 320;
const NOTIFICATION_TEXT_TRUNCATION_SUFFIX = "...";
const PUSH_FAILURE_LOG_SAMPLE_LIMIT = 10; // Keep warning payloads bounded while preserving representative failures.

const CompletionNotificationLogEventName = {
  ntfyPublishFailed: "ntfy-publish-failed",
  pushCompletionSendFailed: "push-completion-send-failed",
  pushCompletionSendThrew: "push-completion-send-threw",
  completionNotificationCheckFailed: "completion-notification-check-failed",
  threadNotificationContextParseFailed: "thread-notification-context-parse-failed",
} as const;

const ThreadNotificationContextSchema = z
  .object({
    preview: z.string().optional(),
    title: z.union([z.string(), z.null()]).optional(),
    cwd: z.string().optional(),
    path: z.string().optional(),
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
  failureDetails: CompletionPushFailureDetail[];
  prunedEndpoints: string[];
}

interface CompletionPushFailureDetail {
  endpoint: string;
  statusCode: number | null;
  message: string;
}

interface CompletionPushFailureLogSummary {
  failureCount: number;
  failureSamples: CompletionPushFailureDetail[];
  omittedFailureCount: number;
}

interface CompletionDispatchTargets {
  hasNtfyTarget: boolean;
  hasWebPushTarget: boolean;
  subscriptions: StoredPushSubscription[];
}

interface NtfyCompletionDispatchResult {
  delivered: boolean;
  messageId: string | null;
}

interface WebPushCompletionDispatchResult {
  attempted: number;
  delivered: number;
  failures: number;
}

const NO_NTFY_COMPLETION_DISPATCH_RESULT: NtfyCompletionDispatchResult = {
  delivered: false,
  messageId: null,
};

const EMPTY_WEB_PUSH_COMPLETION_DISPATCH_RESULT: WebPushCompletionDispatchResult = {
  attempted: 0,
  delivered: 0,
  failures: 0,
};

const DEFAULT_COMPLETION_NOTIFICATION_CONTEXT: CompletionNotificationContext = {
  preview: DEFAULT_THREAD_NOTIFICATION_PREVIEW,
  threadName: DEFAULT_THREAD_NOTIFICATION_NAME,
  projectName: DEFAULT_PROJECT_NAME,
};

// Owns completion notification fan-out and watermark commits.
// Debounced scheduler reruns are expected; commit only advances after delivery succeeds.
export class ThreadCompletionNotificationService {
  private readonly readCodexAdapter: () => CodexAgentAdapter | null;
  private readonly threadConcurrencyCoordinator: ThreadConcurrencyCoordinator;
  private readonly pushMutationConcurrencyCoordinator: PushMutationConcurrencyCoordinator;
  private readonly ntfyNotifier: NtfyNotifier;
  private readonly pushService: PushService;
  private readonly pushStore: PushStore;
  private readonly pushSendStore: PushSendStore;
  private readonly pushSystem: (
    message: string,
    details?: Record<string, string | number | boolean | null>,
  ) => void;
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
    return (
      this.ntfyNotifier.isEnabled() ||
      (this.pushService.isEnabled() && this.pushStore.getSubscriptionCount() > 0)
    );
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
      // Debounced scheduler reruns may re-check the same completion marker.
      // CompletionDetector keeps this path idempotent until commit advances the marker.
      const completionCandidate = this.completionDetector.detect(
        threadId,
        liveState.conversationState,
      );
      if (!completionCandidate) {
        return;
      }

      const dispatchTargets = await this.readCompletionDispatchTargets();
      if (!this.hasCompletionDispatchTarget(dispatchTargets)) {
        return;
      }

      const context = this.readThreadNotificationContext(threadId, liveState.conversationState);

      const ntfyDispatchResult = dispatchTargets.hasNtfyTarget
        ? await this.publishNtfyCompletionNotification({
            threadId,
            completionCandidate,
            context,
          })
        : NO_NTFY_COMPLETION_DISPATCH_RESULT;

      const webPushDispatchResult = dispatchTargets.hasWebPushTarget
        ? await this.dispatchWebPushCompletionNotifications({
            threadId,
            completionCandidate,
            context,
            subscriptions: dispatchTargets.subscriptions,
          })
        : EMPTY_WEB_PUSH_COMPLETION_DISPATCH_RESULT;

      // Watermark commit is gated on at least one successful delivery so future
      // debounced checks can retry the same completion when every channel fails.
      if (!this.hasCompletionDelivery({ ntfyDispatchResult, webPushDispatchResult })) {
        return;
      }

      await this.pushMutationConcurrencyCoordinator.runExclusive(async () => {
        await this.pushStore.setCompletionWatermark(threadId, completionCandidate.marker);
      });
      this.completionDetector.commit(threadId, completionCandidate.marker);
      this.pushSystem(THREAD_COMPLETION_PUSH_SYSTEM_OPERATION_NAME, {
        threadId,
        ntfyDelivered: ntfyDispatchResult.delivered,
        ...(ntfyDispatchResult.messageId !== null
          ? { ntfyMessageId: ntfyDispatchResult.messageId }
          : {}),
        webPushAttempted: webPushDispatchResult.attempted,
        webPushDelivered: webPushDispatchResult.delivered,
        webPushFailures: webPushDispatchResult.failures,
      });
    } catch (error) {
      logger.warn(
        {
          threadId,
          error: this.errorMessageFromValue(error),
        },
        CompletionNotificationLogEventName.completionNotificationCheckFailed,
      );
    }
  }

  private async readCompletionDispatchTargets(): Promise<CompletionDispatchTargets> {
    const hasNtfyTarget = this.ntfyNotifier.isEnabled();
    if (!this.pushService.isEnabled()) {
      return {
        hasNtfyTarget,
        hasWebPushTarget: false,
        subscriptions: [],
      };
    }

    // Read subscriptions under the push-mutation lane so eligibility checks and later pruning stay ordered.
    const subscriptions = await this.pushMutationConcurrencyCoordinator.runExclusive(async () =>
      this.pushStore.listSubscriptions(),
    );
    return {
      hasNtfyTarget,
      hasWebPushTarget: subscriptions.length > 0,
      subscriptions,
    };
  }

  private async publishNtfyCompletionNotification(input: {
    threadId: string;
    completionCandidate: CompletionCandidate;
    context: CompletionNotificationContext;
  }): Promise<NtfyCompletionDispatchResult> {
    try {
      const publishResult = await this.ntfyNotifier.publishThreadCompleted({
        threadId: input.completionCandidate.threadId,
        preview: input.context.preview,
        projectName: input.context.projectName,
        threadName: input.context.threadName,
        agentText: input.completionCandidate.agentText,
      });
      return {
        delivered: true,
        messageId: publishResult.messageId,
      };
    } catch (error) {
      logger.warn(
        {
          threadId: input.threadId,
          error: this.errorMessageFromValue(error),
        },
        CompletionNotificationLogEventName.ntfyPublishFailed,
      );
      return NO_NTFY_COMPLETION_DISPATCH_RESULT;
    }
  }

  private async dispatchWebPushCompletionNotifications(input: {
    threadId: string;
    completionCandidate: CompletionCandidate;
    context: CompletionNotificationContext;
    subscriptions: StoredPushSubscription[];
  }): Promise<WebPushCompletionDispatchResult> {
    const sendAggregate = await this.sendCompletionPushNotifications({
      subscriptions: input.subscriptions,
      threadId: input.completionCandidate.threadId,
      turnId: input.completionCandidate.turnId,
      preview: input.context.preview,
      agentText: input.completionCandidate.agentText,
    });

    await this.pushMutationConcurrencyCoordinator.runExclusive(async () => {
      await this.applyWebPushDispatchResultUnderPushMutationLock(
        sendAggregate,
        input.completionCandidate,
      );
    });

    if (sendAggregate.failureDetails.length > 0) {
      const failureSummary = this.buildPushFailureLogSummary(sendAggregate.failureDetails);
      logger.warn(
        {
          threadId: input.threadId,
          ...failureSummary,
        },
        CompletionNotificationLogEventName.pushCompletionSendFailed,
      );
    }

    return {
      attempted: sendAggregate.attempted,
      delivered: sendAggregate.delivered,
      failures: sendAggregate.failures,
    };
  }

  // Web-push mutation ownership stays under one coordinator lane so subscription
  // pruning and send-summary cache writes remain deterministic.
  private async applyWebPushDispatchResultUnderPushMutationLock(
    sendAggregate: CompletionPushSendAggregate,
    completionCandidate: CompletionCandidate,
  ): Promise<void> {
    await Promise.all(
      sendAggregate.prunedEndpoints.map(async (endpoint) =>
        this.pushStore.removeSubscriptionByEndpoint(endpoint),
      ),
    );

    if (sendAggregate.attempted === 0) {
      return;
    }

    this.pushSendStore.setLatest({
      notificationId: sendAggregate.notificationId,
      threadId: completionCandidate.threadId,
      turnId: completionCandidate.turnId,
      sentAt: sendAggregate.sentAt,
      attempted: sendAggregate.attempted,
      delivered: sendAggregate.delivered,
      failures: sendAggregate.failures,
    });
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
    const url = `${THREAD_ROUTE_PREFIX}${encodeURIComponent(input.threadId)}`;

    const title = input.privateMode
      ? WEB_PUSH_DEFAULT_TITLE
      : (() => {
          const candidate = this.trimNotificationText(input.preview, WEB_PUSH_TITLE_MAX_LENGTH);
          return candidate.length > 0 ? candidate : WEB_PUSH_DEFAULT_TITLE;
        })();

    const body = input.privateMode
      ? WEB_PUSH_DEFAULT_BODY
      : (() => {
          const candidate = this.trimNotificationText(input.agentText, WEB_PUSH_BODY_MAX_LENGTH);
          return candidate.length > 0 ? candidate : WEB_PUSH_DEFAULT_BODY;
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
          icon: WEB_PUSH_NOTIFICATION_ICON_PATH,
          badge: WEB_PUSH_NOTIFICATION_ICON_PATH,
          tag: `${WEB_PUSH_NOTIFICATION_TAG_PREFIX}${input.threadId}`,
        },
      },
    };
  }

  private async sendCompletionPushNotifications(input: {
    subscriptions: StoredPushSubscription[];
    threadId: string;
    turnId: string;
    preview: string;
    agentText: string;
  }): Promise<CompletionPushSendAggregate> {
    // One logical completion send may fan out into private and detailed payload batches.
    // Sharing id/time keeps diagnostics and client dedupe aligned with that single operation.
    const notificationId = `${WEB_PUSH_NOTIFICATION_IDENTIFIER_PREFIX}${randomUUID()}`;
    const sentAt = new Date().toISOString();
    const privateModeSubscriptions = input.subscriptions.filter(
      (subscription) => subscription.settings.privateMode,
    );
    const detailedModeSubscriptions = input.subscriptions.filter(
      (subscription) => !subscription.settings.privateMode,
    );

    let attempted = 0;
    let delivered = 0;
    let failures = 0;
    const failureDetails: CompletionPushFailureDetail[] = [];
    const prunedEndpointSet = new Set<string>();

    const dispatchByPrivacyMode = async (
      subscriptions: StoredPushSubscription[],
      privateMode: boolean,
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
        privateMode,
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
            privateMode,
          },
          CompletionNotificationLogEventName.pushCompletionSendThrew,
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
      prunedEndpoints: Array.from(prunedEndpointSet),
    };
  }

  private trimNotificationText(value: string, maxLength: number): string {
    const normalized = value.trim().replace(/\s+/g, " ");
    if (normalized.length <= maxLength) {
      return normalized;
    }
    return `${normalized.slice(0, maxLength - NOTIFICATION_TEXT_TRUNCATION_SUFFIX.length)}${NOTIFICATION_TEXT_TRUNCATION_SUFFIX}`;
  }

  private hasCompletionDispatchTarget(dispatchTargets: CompletionDispatchTargets): boolean {
    return dispatchTargets.hasNtfyTarget || dispatchTargets.hasWebPushTarget;
  }

  private hasCompletionDelivery(input: {
    ntfyDispatchResult: NtfyCompletionDispatchResult;
    webPushDispatchResult: WebPushCompletionDispatchResult;
  }): boolean {
    return input.ntfyDispatchResult.delivered || input.webPushDispatchResult.delivered > 0;
  }

  private resolveThreadNameForNotificationContext(preview: string, title: string): string {
    return preview.length > 0 ? preview : title;
  }

  private resolveProjectNameForNotificationContext(
    cwd: string | null,
    pathValue: string | null,
  ): string {
    if (cwd !== null) {
      return this.projectLabelFromPath(cwd);
    }
    if (pathValue !== null) {
      return this.projectLabelFromPath(pathValue);
    }
    return DEFAULT_PROJECT_NAME;
  }

  private readThreadNotificationContext(
    threadId: string,
    value: AgentThreadLiveState["conversationState"],
  ): CompletionNotificationContext {
    const parsed = ThreadNotificationContextSchema.safeParse(value);
    if (!parsed.success) {
      logger.warn(
        {
          threadId,
          issueCount: parsed.error.issues.length,
        },
        CompletionNotificationLogEventName.threadNotificationContextParseFailed,
      );
      return DEFAULT_COMPLETION_NOTIFICATION_CONTEXT;
    }

    const preview = this.normalizeOptionalString(parsed.data.preview ?? null) ?? "";
    const title = this.normalizeOptionalString(parsed.data.title ?? null) ?? "";
    const cwd = this.normalizeOptionalString(parsed.data.cwd ?? null);
    const pathValue = this.normalizeOptionalString(parsed.data.path ?? null);

    // Preserve priority order used by downstream notification owners:
    // preview text wins for thread label, then title, while cwd outranks path for project label.
    return {
      preview,
      threadName: this.resolveThreadNameForNotificationContext(preview, title),
      projectName: this.resolveProjectNameForNotificationContext(cwd, pathValue),
    };
  }

  private normalizeOptionalString(value: string | null): string | null {
    if (value === null || value.length === 0) {
      return null;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private projectLabelFromPath(value: string): string {
    const normalized = this.normalizeProjectPathForLabel(value);
    if (normalized.length === 0) {
      return DEFAULT_PROJECT_NAME;
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

  private buildPushFailureLogSummary(
    failureDetails: CompletionPushFailureDetail[],
  ): CompletionPushFailureLogSummary {
    const failureSamples = failureDetails.slice(0, PUSH_FAILURE_LOG_SAMPLE_LIMIT);
    return {
      failureCount: failureDetails.length,
      failureSamples,
      omittedFailureCount: failureDetails.length - failureSamples.length,
    };
  }
}

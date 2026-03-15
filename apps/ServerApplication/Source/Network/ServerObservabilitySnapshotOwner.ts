import { FarfieldDebugObservabilitySnapshotSchema } from "@farfield/protocol";
import type {
  ThreadAdapterResolver,
  ThreadAdapterResolverStatistics,
} from "../Agents/ThreadAdapterResolver.js";
import type { ActivityHistoryService } from "../Modules/Activity/ActivityHistoryService.js";
import type { ActivityHistoryRetentionStatistics } from "../Modules/Activity/ActivityHistoryStoreOwner.js";
import type {
  EventLoopLagObservabilityOwner,
  EventLoopLagStatistics,
} from "./EventLoopLagObservabilityOwner.js";
import type {
  EventStreamClientRegistry,
  EventStreamClientRegistryStatistics,
} from "./EventStreamClientRegistry.js";
import type { PushDispatchConcurrencyCoordinator } from "./PushDispatchConcurrencyCoordinator.js";
import type {
  PushMutationConcurrencyCoordinator,
  PushMutationConcurrencyCoordinatorStatistics,
} from "./PushMutationConcurrencyCoordinator.js";
import type {
  RequestObservabilityOwner,
  RequestObservabilitySnapshot,
} from "./RequestObservabilityOwner.js";
import type {
  SidebarThreadSyncSnapshotCache,
  SidebarThreadSyncSnapshotCacheStatistics,
} from "./SidebarThreadSyncSnapshotCache.js";
import type { ThreadConcurrencyCoordinator } from "./ThreadConcurrencyCoordinator.js";
import type {
  ThreadListAggregationCache,
  ThreadListAggregationCacheStatistics,
} from "./ThreadListAggregationCache.js";
import type {
  ThreadSendProgressObservabilityOwner,
  ThreadSendProgressObservabilityStatistics,
} from "./ThreadSendProgressObservabilityOwner.js";

const DEFAULT_READ_NOW_ISO_STRING = (): string => new Date().toISOString();

interface ServerObservabilityThreadConcurrencySnapshot {
  queuedExecutionCount: number;
  completedExecutionCount: number;
  failedExecutionCount: number;
  activeThreadCount: number;
  inFlightThreadCount: number;
  pendingExecutionCount: number;
  blockedExecutionCount: number;
  lastBlockedWaitMs: number;
  p95BlockedWaitMs: number;
  maxBlockedWaitMs: number;
}

interface ServerObservabilityPushDispatchConcurrencySnapshot {
  scheduledCheckCount: number;
  startedCheckCount: number;
  completedCheckCount: number;
  skippedWhileInFlightCount: number;
  activeTimerCount: number;
  inFlightThreadCount: number;
}

export interface ServerObservabilitySnapshot {
  recordedAt: string;
  cache: {
    threadListAggregation: ThreadListAggregationCacheStatistics;
    sidebarThreadSyncSnapshot: SidebarThreadSyncSnapshotCacheStatistics;
  };
  concurrency: {
    thread: ServerObservabilityThreadConcurrencySnapshot;
    pushDispatch: ServerObservabilityPushDispatchConcurrencySnapshot;
    pushMutation: PushMutationConcurrencyCoordinatorStatistics;
  };
  streaming: {
    eventStream: EventStreamClientRegistryStatistics;
  };
  routing: {
    threadAdapterResolver: ThreadAdapterResolverStatistics;
  };
  performance: {
    requestRouting: RequestObservabilitySnapshot;
    eventLoop: EventLoopLagStatistics;
    threadSendProgression: ThreadSendProgressObservabilityStatistics;
    activityHistory: ActivityHistoryRetentionStatistics;
  };
}

export interface ServerObservabilitySnapshotOwnerDependencies {
  threadListAggregationCache: ThreadListAggregationCache;
  sidebarThreadSyncSnapshotCache: SidebarThreadSyncSnapshotCache;
  threadConcurrencyCoordinator: ThreadConcurrencyCoordinator;
  pushDispatchConcurrencyCoordinator: PushDispatchConcurrencyCoordinator;
  pushMutationConcurrencyCoordinator: PushMutationConcurrencyCoordinator;
  eventStreamClientRegistry: EventStreamClientRegistry;
  threadAdapterResolver: ThreadAdapterResolver;
  requestObservabilityOwner: RequestObservabilityOwner;
  eventLoopLagObservabilityOwner: EventLoopLagObservabilityOwner;
  threadSendProgressObservabilityOwner: ThreadSendProgressObservabilityOwner;
  activityHistoryService: ActivityHistoryService;
  readNowIsoString?: () => string;
}

/**
 * Owns process-local observability snapshot composition and enforces the shared
 * protocol snapshot contract before returning data to route owners.
 */
export class ServerObservabilitySnapshotOwner {
  private readonly dependencies: ServerObservabilitySnapshotOwnerDependencies;
  private readonly readNowIsoString: () => string;

  public constructor(dependencies: ServerObservabilitySnapshotOwnerDependencies) {
    this.dependencies = dependencies;
    this.readNowIsoString = dependencies.readNowIsoString ?? DEFAULT_READ_NOW_ISO_STRING;
  }

  public readSnapshot(): ServerObservabilitySnapshot {
    const threadConcurrencyStatistics =
      this.dependencies.threadConcurrencyCoordinator.readStatistics();
    const pushDispatchConcurrencyStatistics =
      this.dependencies.pushDispatchConcurrencyCoordinator.readStatistics();

    // Keep the emitted snapshot aligned to the protocol schema instead of leaking owner-internal counters.
    const snapshot: ServerObservabilitySnapshot = {
      recordedAt: this.readNowIsoString(),
      cache: {
        threadListAggregation: this.dependencies.threadListAggregationCache.readStatistics(),
        sidebarThreadSyncSnapshot:
          this.dependencies.sidebarThreadSyncSnapshotCache.readStatistics(),
      },
      concurrency: {
        thread: {
          queuedExecutionCount: threadConcurrencyStatistics.queuedExecutionCount,
          completedExecutionCount: threadConcurrencyStatistics.completedExecutionCount,
          failedExecutionCount: threadConcurrencyStatistics.failedExecutionCount,
          activeThreadCount: threadConcurrencyStatistics.activeThreadCount,
          inFlightThreadCount: threadConcurrencyStatistics.inFlightThreadCount,
          pendingExecutionCount: threadConcurrencyStatistics.pendingExecutionCount,
          blockedExecutionCount: threadConcurrencyStatistics.blockedExecutionCount,
          lastBlockedWaitMs: threadConcurrencyStatistics.lastBlockedWaitMs,
          p95BlockedWaitMs: threadConcurrencyStatistics.p95BlockedWaitMs,
          maxBlockedWaitMs: threadConcurrencyStatistics.maxBlockedWaitMs,
        },
        pushDispatch: {
          scheduledCheckCount: pushDispatchConcurrencyStatistics.scheduledCheckCount,
          startedCheckCount: pushDispatchConcurrencyStatistics.startedCheckCount,
          completedCheckCount: pushDispatchConcurrencyStatistics.completedCheckCount,
          skippedWhileInFlightCount: pushDispatchConcurrencyStatistics.skippedWhileInFlightCount,
          activeTimerCount: pushDispatchConcurrencyStatistics.activeTimerCount,
          inFlightThreadCount: pushDispatchConcurrencyStatistics.inFlightThreadCount,
        },
        pushMutation: this.dependencies.pushMutationConcurrencyCoordinator.readStatistics(),
      },
      streaming: {
        eventStream: this.dependencies.eventStreamClientRegistry.readStatistics(),
      },
      routing: {
        threadAdapterResolver: this.dependencies.threadAdapterResolver.readStatistics(),
      },
      performance: {
        requestRouting: this.dependencies.requestObservabilityOwner.readSnapshot(),
        eventLoop: this.dependencies.eventLoopLagObservabilityOwner.readStatistics(),
        threadSendProgression:
          this.dependencies.threadSendProgressObservabilityOwner.readStatistics(),
        activityHistory: this.dependencies.activityHistoryService.readRetentionStatistics(),
      },
    };

    return FarfieldDebugObservabilitySnapshotSchema.parse(snapshot);
  }
}

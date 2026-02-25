import type { EventStreamClientRegistry, EventStreamClientRegistryStatistics } from "./EventStreamClientRegistry.js";
import type { PushDispatchConcurrencyCoordinator, PushDispatchConcurrencyCoordinatorStatistics } from "./PushDispatchConcurrencyCoordinator.js";
import type {
  PushMutationConcurrencyCoordinator,
  PushMutationConcurrencyCoordinatorStatistics
} from "./PushMutationConcurrencyCoordinator.js";
import type { ThreadConcurrencyCoordinator, ThreadConcurrencyCoordinatorStatistics } from "./ThreadConcurrencyCoordinator.js";
import type { ThreadListAggregationCache, ThreadListAggregationCacheStatistics } from "./ThreadListAggregationCache.js";
import type { ThreadAdapterResolver, ThreadAdapterResolverStatistics } from "../Agents/ThreadAdapterResolver.js";

export interface ServerObservabilitySnapshot {
  recordedAt: string;
  cache: {
    threadListAggregation: ThreadListAggregationCacheStatistics;
  };
  concurrency: {
    thread: ThreadConcurrencyCoordinatorStatistics;
    pushDispatch: PushDispatchConcurrencyCoordinatorStatistics;
    pushMutation: PushMutationConcurrencyCoordinatorStatistics;
  };
  streaming: {
    eventStream: EventStreamClientRegistryStatistics;
  };
  routing: {
    threadAdapterResolver: ThreadAdapterResolverStatistics;
  };
}

export interface ServerObservabilitySnapshotOwnerDependencies {
  threadListAggregationCache: ThreadListAggregationCache;
  threadConcurrencyCoordinator: ThreadConcurrencyCoordinator;
  pushDispatchConcurrencyCoordinator: PushDispatchConcurrencyCoordinator;
  pushMutationConcurrencyCoordinator: PushMutationConcurrencyCoordinator;
  eventStreamClientRegistry: EventStreamClientRegistry;
  threadAdapterResolver: ThreadAdapterResolver;
}

export class ServerObservabilitySnapshotOwner {
  private readonly dependencies: ServerObservabilitySnapshotOwnerDependencies;

  public constructor(dependencies: ServerObservabilitySnapshotOwnerDependencies) {
    this.dependencies = dependencies;
  }

  public readSnapshot(): ServerObservabilitySnapshot {
    return {
      recordedAt: new Date().toISOString(),
      cache: {
        threadListAggregation: this.dependencies.threadListAggregationCache.readStatistics()
      },
      concurrency: {
        thread: this.dependencies.threadConcurrencyCoordinator.readStatistics(),
        pushDispatch: this.dependencies.pushDispatchConcurrencyCoordinator.readStatistics(),
        pushMutation: this.dependencies.pushMutationConcurrencyCoordinator.readStatistics()
      },
      streaming: {
        eventStream: this.dependencies.eventStreamClientRegistry.readStatistics()
      },
      routing: {
        threadAdapterResolver: this.dependencies.threadAdapterResolver.readStatistics()
      }
    };
  }
}

import { ThreadMemberArchiveMutationRouteOwner } from "./ThreadMemberArchiveMutationRouteOwner.js";
import { ThreadMemberBackgroundTerminalsCleanMutationRouteOwner } from "./ThreadMemberBackgroundTerminalsCleanMutationRouteOwner.js";
import { ThreadMemberCompactMutationRouteOwner } from "./ThreadMemberCompactMutationRouteOwner.js";
import { ThreadMemberForkFromMessageMutationRouteOwner } from "./ThreadMemberForkFromMessageMutationRouteOwner.js";
import { ThreadMemberForkMutationRouteOwner } from "./ThreadMemberForkMutationRouteOwner.js";
import { ThreadMemberInteractionMutationRouteOwner } from "./ThreadMemberInteractionMutationRouteOwner.js";
import { ThreadMemberMessageMutationRouteOwner } from "./ThreadMemberMessageMutationRouteOwner.js";
import { ThreadMemberNameMutationRouteOwner } from "./ThreadMemberNameMutationRouteOwner.js";
import { ThreadMemberReviewMutationRouteOwner } from "./ThreadMemberReviewMutationRouteOwner.js";
import { ThreadMemberRollbackMutationRouteOwner } from "./ThreadMemberRollbackMutationRouteOwner.js";
import {
  isThreadMemberSubresourceRoute,
  type ThreadMemberResolvedRouteContext,
  type ThreadMemberRouteDependencies,
  ThreadMemberRouteMethodByName,
  ThreadMemberRouteSegmentByName,
} from "./ThreadMemberRouteContracts.js";
import { ThreadMemberUnsubscribeMutationRouteOwner } from "./ThreadMemberUnsubscribeMutationRouteOwner.js";

export interface ThreadMemberMutationRouteOwnerOptions {
  dependencies: ThreadMemberRouteDependencies;
  context: ThreadMemberResolvedRouteContext;
}

const ThreadMemberMutationRouteOwnerNameByName = {
  message: "message",
  archive: "archive",
  unsubscribe: "unsubscribe",
  interaction: "interaction",
  fork: "fork",
  forkFromMessage: "fork-from-message",
  name: "name",
  review: "review",
  rollback: "rollback",
  compact: "compact",
  backgroundTerminalsClean: "background-terminals-clean",
} as const;

type ThreadMemberMutationRouteOwnerName =
  (typeof ThreadMemberMutationRouteOwnerNameByName)[keyof typeof ThreadMemberMutationRouteOwnerNameByName];

type ThreadMemberMutationSubresource =
  | typeof ThreadMemberRouteSegmentByName.messages
  | typeof ThreadMemberRouteSegmentByName.archive
  | typeof ThreadMemberRouteSegmentByName.unarchive
  | typeof ThreadMemberRouteSegmentByName.unsubscribe
  | typeof ThreadMemberRouteSegmentByName.fork
  | typeof ThreadMemberRouteSegmentByName.forkMessage
  | typeof ThreadMemberRouteSegmentByName.name
  | typeof ThreadMemberRouteSegmentByName.review
  | typeof ThreadMemberRouteSegmentByName.rollback
  | typeof ThreadMemberRouteSegmentByName.compact
  | typeof ThreadMemberRouteSegmentByName.backgroundTerminalsClean
  | typeof ThreadMemberRouteSegmentByName.collaborationMode
  | typeof ThreadMemberRouteSegmentByName.userInput
  | typeof ThreadMemberRouteSegmentByName.interrupt;

interface ThreadMemberMutationDispatchDescriptor {
  subresource: ThreadMemberMutationSubresource;
  ownerName: ThreadMemberMutationRouteOwnerName;
}

type ThreadMemberMutationHandlerFactory = (options: ThreadMemberMutationRouteOwnerOptions) => {
  handle: () => Promise<boolean>;
};

// Canonical subresource dispatch ownership is centralized so mutation routing remains deterministic.
const ThreadMemberMutationDispatchDescriptors: readonly ThreadMemberMutationDispatchDescriptor[] = [
  {
    subresource: ThreadMemberRouteSegmentByName.messages,
    ownerName: ThreadMemberMutationRouteOwnerNameByName.message,
  },
  {
    subresource: ThreadMemberRouteSegmentByName.archive,
    ownerName: ThreadMemberMutationRouteOwnerNameByName.archive,
  },
  {
    subresource: ThreadMemberRouteSegmentByName.unarchive,
    ownerName: ThreadMemberMutationRouteOwnerNameByName.archive,
  },
  {
    subresource: ThreadMemberRouteSegmentByName.unsubscribe,
    ownerName: ThreadMemberMutationRouteOwnerNameByName.unsubscribe,
  },
  {
    subresource: ThreadMemberRouteSegmentByName.fork,
    ownerName: ThreadMemberMutationRouteOwnerNameByName.fork,
  },
  {
    subresource: ThreadMemberRouteSegmentByName.forkMessage,
    ownerName: ThreadMemberMutationRouteOwnerNameByName.forkFromMessage,
  },
  {
    subresource: ThreadMemberRouteSegmentByName.name,
    ownerName: ThreadMemberMutationRouteOwnerNameByName.name,
  },
  {
    subresource: ThreadMemberRouteSegmentByName.review,
    ownerName: ThreadMemberMutationRouteOwnerNameByName.review,
  },
  {
    subresource: ThreadMemberRouteSegmentByName.rollback,
    ownerName: ThreadMemberMutationRouteOwnerNameByName.rollback,
  },
  {
    subresource: ThreadMemberRouteSegmentByName.compact,
    ownerName: ThreadMemberMutationRouteOwnerNameByName.compact,
  },
  {
    subresource: ThreadMemberRouteSegmentByName.backgroundTerminalsClean,
    ownerName: ThreadMemberMutationRouteOwnerNameByName.backgroundTerminalsClean,
  },
  {
    subresource: ThreadMemberRouteSegmentByName.collaborationMode,
    ownerName: ThreadMemberMutationRouteOwnerNameByName.interaction,
  },
  {
    subresource: ThreadMemberRouteSegmentByName.userInput,
    ownerName: ThreadMemberMutationRouteOwnerNameByName.interaction,
  },
  {
    subresource: ThreadMemberRouteSegmentByName.interrupt,
    ownerName: ThreadMemberMutationRouteOwnerNameByName.interaction,
  },
];

const ThreadMemberMutationHandlerFactoryByOwnerName: Record<
  ThreadMemberMutationRouteOwnerName,
  ThreadMemberMutationHandlerFactory
> = {
  [ThreadMemberMutationRouteOwnerNameByName.message]: (options) =>
    new ThreadMemberMessageMutationRouteOwner(options),
  [ThreadMemberMutationRouteOwnerNameByName.archive]: (options) =>
    new ThreadMemberArchiveMutationRouteOwner(options),
  [ThreadMemberMutationRouteOwnerNameByName.unsubscribe]: (options) =>
    new ThreadMemberUnsubscribeMutationRouteOwner(options),
  [ThreadMemberMutationRouteOwnerNameByName.interaction]: (options) =>
    new ThreadMemberInteractionMutationRouteOwner(options),
  [ThreadMemberMutationRouteOwnerNameByName.fork]: (options) =>
    new ThreadMemberForkMutationRouteOwner(options),
  [ThreadMemberMutationRouteOwnerNameByName.forkFromMessage]: (options) =>
    new ThreadMemberForkFromMessageMutationRouteOwner(options),
  [ThreadMemberMutationRouteOwnerNameByName.name]: (options) =>
    new ThreadMemberNameMutationRouteOwner(options),
  [ThreadMemberMutationRouteOwnerNameByName.review]: (options) =>
    new ThreadMemberReviewMutationRouteOwner(options),
  [ThreadMemberMutationRouteOwnerNameByName.rollback]: (options) =>
    new ThreadMemberRollbackMutationRouteOwner(options),
  [ThreadMemberMutationRouteOwnerNameByName.compact]: (options) =>
    new ThreadMemberCompactMutationRouteOwner(options),
  [ThreadMemberMutationRouteOwnerNameByName.backgroundTerminalsClean]: (options) =>
    new ThreadMemberBackgroundTerminalsCleanMutationRouteOwner(options),
};

export class ThreadMemberMutationRouteOwner {
  private readonly dependencies: ThreadMemberRouteDependencies;
  private readonly context: ThreadMemberResolvedRouteContext;

  public constructor(options: ThreadMemberMutationRouteOwnerOptions) {
    this.dependencies = options.dependencies;
    this.context = options.context;
  }

  public async handle(): Promise<boolean> {
    const matchedOwnerName = this.tryResolveMatchedOwnerName();
    if (matchedOwnerName === null) {
      return false;
    }

    const ownerOptions: ThreadMemberMutationRouteOwnerOptions = {
      dependencies: this.dependencies,
      context: this.context,
    };
    const createRouteOwner = ThreadMemberMutationHandlerFactoryByOwnerName[matchedOwnerName];
    const routeOwner = createRouteOwner(ownerOptions);
    return routeOwner.handle();
  }

  private tryResolveMatchedOwnerName(): ThreadMemberMutationRouteOwnerName | null {
    if (this.dependencies.req.method !== ThreadMemberRouteMethodByName.post) {
      return null;
    }

    for (const dispatchDescriptor of ThreadMemberMutationDispatchDescriptors) {
      if (
        isThreadMemberSubresourceRoute(this.dependencies.segments, dispatchDescriptor.subresource)
      ) {
        return dispatchDescriptor.ownerName;
      }
    }

    return null;
  }
}

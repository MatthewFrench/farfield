import { ThreadMemberArchiveMutationRouteOwner } from "./ThreadMemberArchiveMutationRouteOwner.js";
import { ThreadMemberInteractionMutationRouteOwner } from "./ThreadMemberInteractionMutationRouteOwner.js";
import { ThreadMemberMessageMutationRouteOwner } from "./ThreadMemberMessageMutationRouteOwner.js";
import {
  isThreadMemberSubresourceRoute,
  type ThreadMemberResolvedRouteContext,
  type ThreadMemberRouteDependencies,
  ThreadMemberRouteMethodByName,
  ThreadMemberRouteSegmentByName,
} from "./ThreadMemberRouteContracts.js";

export interface ThreadMemberMutationRouteOwnerOptions {
  dependencies: ThreadMemberRouteDependencies;
  context: ThreadMemberResolvedRouteContext;
}

const ThreadMemberMutationRouteOwnerNameByName = {
  message: "message",
  archive: "archive",
  interaction: "interaction",
} as const;

type ThreadMemberMutationRouteOwnerName =
  (typeof ThreadMemberMutationRouteOwnerNameByName)[keyof typeof ThreadMemberMutationRouteOwnerNameByName];

type ThreadMemberMutationSubresource =
  | typeof ThreadMemberRouteSegmentByName.messages
  | typeof ThreadMemberRouteSegmentByName.archive
  | typeof ThreadMemberRouteSegmentByName.unarchive
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
  [ThreadMemberMutationRouteOwnerNameByName.interaction]: (options) =>
    new ThreadMemberInteractionMutationRouteOwner(options),
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

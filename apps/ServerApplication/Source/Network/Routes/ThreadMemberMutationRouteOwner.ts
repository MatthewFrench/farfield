import type { ThreadMemberRouteDependencies, ThreadMemberResolvedRouteContext } from "./ThreadMemberRouteContracts.js";
import {
  ThreadMemberArchiveMutationRouteOwner
} from "./ThreadMemberArchiveMutationRouteOwner.js";
import {
  ThreadMemberInteractionMutationRouteOwner
} from "./ThreadMemberInteractionMutationRouteOwner.js";
import {
  ThreadMemberMessageMutationRouteOwner
} from "./ThreadMemberMessageMutationRouteOwner.js";

export interface ThreadMemberMutationRouteOwnerOptions {
  dependencies: ThreadMemberRouteDependencies;
  context: ThreadMemberResolvedRouteContext;
}

type ThreadMemberMutationHandlerFactory = (
  options: ThreadMemberMutationRouteOwnerOptions
) => { handle: () => Promise<boolean> };

const ThreadMemberMutationHandlerFactories: readonly ThreadMemberMutationHandlerFactory[] = [
  (options) => new ThreadMemberMessageMutationRouteOwner(options),
  (options) => new ThreadMemberArchiveMutationRouteOwner(options),
  (options) => new ThreadMemberInteractionMutationRouteOwner(options)
];

export class ThreadMemberMutationRouteOwner {
  private readonly dependencies: ThreadMemberRouteDependencies;
  private readonly context: ThreadMemberResolvedRouteContext;

  public constructor(options: ThreadMemberMutationRouteOwnerOptions) {
    this.dependencies = options.dependencies;
    this.context = options.context;
  }

  public async handle(): Promise<boolean> {
    const ownerOptions: ThreadMemberMutationRouteOwnerOptions = {
      dependencies: this.dependencies,
      context: this.context
    };
    for (const createHandler of ThreadMemberMutationHandlerFactories) {
      const routeOwner = createHandler(ownerOptions);
      if (await routeOwner.handle()) {
        return true;
      }
    }

    return false;
  }
}

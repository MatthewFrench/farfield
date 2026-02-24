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

export class ThreadMemberMutationRouteOwner {
  private readonly dependencies: ThreadMemberRouteDependencies;
  private readonly context: ThreadMemberResolvedRouteContext;

  public constructor(options: ThreadMemberMutationRouteOwnerOptions) {
    this.dependencies = options.dependencies;
    this.context = options.context;
  }

  public async handle(): Promise<boolean> {
    const messageMutationRouteOwner = new ThreadMemberMessageMutationRouteOwner({
      dependencies: this.dependencies,
      context: this.context
    });
    if (await messageMutationRouteOwner.handle()) {
      return true;
    }

    const archiveMutationRouteOwner = new ThreadMemberArchiveMutationRouteOwner({
      dependencies: this.dependencies,
      context: this.context
    });
    if (await archiveMutationRouteOwner.handle()) {
      return true;
    }

    const interactionMutationRouteOwner = new ThreadMemberInteractionMutationRouteOwner({
      dependencies: this.dependencies,
      context: this.context
    });
    return interactionMutationRouteOwner.handle();
  }
}

import {
  ThreadMemberMutationRouteOwner
} from "./ThreadMemberMutationRouteOwner.js";
import {
  ThreadMemberReadRouteOwner
} from "./ThreadMemberReadRouteOwner.js";
import type {
  ThreadMemberRouteDependencies
} from "./ThreadMemberRouteContracts.js";

export type { ThreadMemberRouteDependencies } from "./ThreadMemberRouteContracts.js";

export async function handleThreadMemberRoutes(
  dependencies: ThreadMemberRouteDependencies
): Promise<boolean> {
  const { segments, resolveAdapterForThread, jsonResponse, res } = dependencies;

  if (!(segments[0] === "api" && segments[1] === "threads" && segments[2])) {
    return false;
  }

  const threadId = decodeURIComponent(segments[2]);
  const resolved = resolveAdapterForThread(threadId);
  if (!resolved.ok) {
    jsonResponse(res, resolved.status, {
      ok: false,
      error: resolved.error,
      threadId
    });
    return true;
  }

  const context = {
    threadId,
    adapter: resolved.adapter,
    agentId: resolved.agentId
  };

  const readRouteOwner = new ThreadMemberReadRouteOwner({
    dependencies,
    context
  });
  if (await readRouteOwner.handle()) {
    return true;
  }

  const mutationRouteOwner = new ThreadMemberMutationRouteOwner({
    dependencies,
    context
  });
  return mutationRouteOwner.handle();
}

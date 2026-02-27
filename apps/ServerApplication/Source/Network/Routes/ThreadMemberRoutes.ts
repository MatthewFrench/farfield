import { z } from "zod";
import { ThreadMemberMutationRouteOwner } from "./ThreadMemberMutationRouteOwner.js";
import { ThreadMemberReadRouteOwner } from "./ThreadMemberReadRouteOwner.js";
import {
  type ThreadMemberRouteDependencies,
  ThreadMemberRouteSegmentByName,
  ThreadMemberRouteSegmentIndexByName,
} from "./ThreadMemberRouteContracts.js";

export type { ThreadMemberRouteDependencies } from "./ThreadMemberRouteContracts.js";

const ThreadMemberRouteStatusCodeByName = {
  badRequest: 400,
} as const;

const ThreadMemberRouteErrorByName = {
  invalidThreadIdentifier: "Invalid thread identifier",
} as const;

// Boundary route parsing keeps `/api/threads/:threadId*` ownership deterministic and explicit.
const ThreadMemberRouteSegmentsSchema = z
  .tuple([
    z.literal(ThreadMemberRouteSegmentByName.api),
    z.literal(ThreadMemberRouteSegmentByName.threads),
    z.string().min(1),
  ])
  .rest(z.string());

type ThreadMemberRouteSegments = [
  typeof ThreadMemberRouteSegmentByName.api,
  typeof ThreadMemberRouteSegmentByName.threads,
  string,
  ...string[],
];

export async function handleThreadMemberRoutes(
  dependencies: ThreadMemberRouteDependencies,
): Promise<boolean> {
  const { segments, resolveAdapterForThread, jsonResponse, res } = dependencies;
  const parsedSegments = parseThreadMemberRouteSegments(segments);
  if (parsedSegments === null) {
    return false;
  }

  const rawThreadIdentifier = parsedSegments[ThreadMemberRouteSegmentIndexByName.threadIdentifier];
  const threadId = tryDecodeThreadIdentifier(rawThreadIdentifier);
  if (threadId === null) {
    jsonResponse(res, ThreadMemberRouteStatusCodeByName.badRequest, {
      ok: false,
      error: ThreadMemberRouteErrorByName.invalidThreadIdentifier,
    });
    return true;
  }

  const resolved = await resolveAdapterForThread(threadId);
  if (!resolved.ok) {
    jsonResponse(res, resolved.status, {
      ok: false,
      error: resolved.error,
      threadId,
    });
    return true;
  }

  const context = {
    threadId,
    adapter: resolved.adapter,
    agentId: resolved.agentId,
  };

  const readRouteOwner = new ThreadMemberReadRouteOwner({
    dependencies,
    context,
  });
  if (await readRouteOwner.handle()) {
    return true;
  }

  const mutationRouteOwner = new ThreadMemberMutationRouteOwner({
    dependencies,
    context,
  });
  return mutationRouteOwner.handle();
}

function parseThreadMemberRouteSegments(
  segments: readonly string[],
): ThreadMemberRouteSegments | null {
  const parsedSegments = ThreadMemberRouteSegmentsSchema.safeParse(segments);
  if (!parsedSegments.success) {
    return null;
  }
  return parsedSegments.data;
}

function tryDecodeThreadIdentifier(rawThreadIdentifier: string): string | null {
  try {
    return decodeURIComponent(rawThreadIdentifier);
  } catch {
    return null;
  }
}

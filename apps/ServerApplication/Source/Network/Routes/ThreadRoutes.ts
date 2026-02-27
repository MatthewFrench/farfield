import {
  handleThreadCollectionRoutes,
  type ThreadCollectionRouteDependencies,
} from "./ThreadCollectionRoutes.js";
import {
  handleThreadMemberRoutes,
  type ThreadMemberRouteDependencies,
} from "./ThreadMemberRoutes.js";

export interface ThreadRouteDependencies
  extends ThreadCollectionRouteDependencies,
    ThreadMemberRouteDependencies {}

export async function handleThreadRoutes(dependencies: ThreadRouteDependencies): Promise<boolean> {
  // Keep collection routing first so canonical `/api/threads` ownership is decided
  // before member-route adapter resolution is attempted.
  const handledByThreadCollectionRoutes = await handleThreadCollectionRoutes(dependencies);
  if (handledByThreadCollectionRoutes) {
    return true;
  }

  return handleThreadMemberRoutes(dependencies);
}

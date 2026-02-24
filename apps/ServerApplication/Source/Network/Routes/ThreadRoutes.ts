import {
  handleThreadCollectionRoutes,
  type ThreadCollectionRouteDependencies
} from "./ThreadCollectionRoutes.js";
import {
  handleThreadMemberRoutes,
  type ThreadMemberRouteDependencies
} from "./ThreadMemberRoutes.js";

export interface ThreadRouteDependencies
  extends ThreadCollectionRouteDependencies, ThreadMemberRouteDependencies {}

export async function handleThreadRoutes(deps: ThreadRouteDependencies): Promise<boolean> {
  if (await handleThreadCollectionRoutes(deps)) {
    return true;
  }

  return handleThreadMemberRoutes(deps);
}

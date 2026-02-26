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

type ThreadRouteHandler = (dependencies: ThreadRouteDependencies) => Promise<boolean>;

const ThreadRouteHandlers: readonly ThreadRouteHandler[] = [
  handleThreadCollectionRoutes,
  handleThreadMemberRoutes
];

export async function handleThreadRoutes(deps: ThreadRouteDependencies): Promise<boolean> {
  for (const handleRoute of ThreadRouteHandlers) {
    if (await handleRoute(deps)) {
      return true;
    }
  }

  return false;
}

import { DebugClientErrorRouteOwner } from "./DebugClientErrorRouteOwner.js";
import { DebugHistoryRouteOwner } from "./DebugHistoryRouteOwner.js";
import { DebugReplayRouteOwner } from "./DebugReplayRouteOwner.js";
import { type DebugRouteDependencies, DebugRouteSegmentByName } from "./DebugRouteContracts.js";
import { DebugTraceRouteOwner } from "./DebugTraceRouteOwner.js";

export type { DebugRouteDependencies } from "./DebugRouteContracts.js";

const DebugRoutePrefixSegmentIndexByName = {
  api: 0,
  debug: 1,
} as const;

interface DebugRouteOwner {
  handle: () => Promise<boolean>;
}

type DebugRouteOwnerFactory = (dependencies: DebugRouteDependencies) => DebugRouteOwner;

// Dispatch order is a contract so route ownership remains deterministic as debug paths evolve.
const DebugRouteOwnerFactoriesByDispatchOrder: ReadonlyArray<DebugRouteOwnerFactory> = [
  (dependencies) => new DebugClientErrorRouteOwner(dependencies),
  (dependencies) => new DebugHistoryRouteOwner(dependencies),
  (dependencies) => new DebugReplayRouteOwner(dependencies),
  (dependencies) => new DebugTraceRouteOwner(dependencies),
];

function isDebugRoutePrefix(segments: ReadonlyArray<string>): boolean {
  return (
    segments[DebugRoutePrefixSegmentIndexByName.api] === DebugRouteSegmentByName.api &&
    segments[DebugRoutePrefixSegmentIndexByName.debug] === DebugRouteSegmentByName.debug
  );
}

async function dispatchDebugRouteOwners(dependencies: DebugRouteDependencies): Promise<boolean> {
  for (const buildRouteOwner of DebugRouteOwnerFactoriesByDispatchOrder) {
    const routeOwner = buildRouteOwner(dependencies);
    if (await routeOwner.handle()) {
      return true;
    }
  }

  return false;
}

export async function handleDebugRoutes(dependencies: DebugRouteDependencies): Promise<boolean> {
  const { segments } = dependencies;

  if (!isDebugRoutePrefix(segments)) {
    return false;
  }

  return dispatchDebugRouteOwners(dependencies);
}

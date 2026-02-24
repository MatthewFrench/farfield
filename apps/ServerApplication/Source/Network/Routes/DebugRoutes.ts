import {
  DebugClientErrorRouteOwner
} from "./DebugClientErrorRouteOwner.js";
import {
  DebugHistoryRouteOwner
} from "./DebugHistoryRouteOwner.js";
import {
  DebugReplayRouteOwner
} from "./DebugReplayRouteOwner.js";
import {
  DebugTraceRouteOwner
} from "./DebugTraceRouteOwner.js";
import { type DebugRouteDependencies } from "./DebugRouteContracts.js";

export type { DebugRouteDependencies } from "./DebugRouteContracts.js";

export async function handleDebugRoutes(dependencies: DebugRouteDependencies): Promise<boolean> {
  const { segments } = dependencies;

  if (segments[0] !== "api" || segments[1] !== "debug") {
    return false;
  }

  const clientErrorRouteOwner = new DebugClientErrorRouteOwner(dependencies);
  if (await clientErrorRouteOwner.handle()) {
    return true;
  }

  const historyRouteOwner = new DebugHistoryRouteOwner(dependencies);
  if (await historyRouteOwner.handle()) {
    return true;
  }

  const replayRouteOwner = new DebugReplayRouteOwner(dependencies);
  if (await replayRouteOwner.handle()) {
    return true;
  }

  const traceRouteOwner = new DebugTraceRouteOwner(dependencies);
  return traceRouteOwner.handle();
}

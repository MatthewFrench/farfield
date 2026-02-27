export interface ApplicationRouteState {
  threadId: string | null;
  tab: "chat" | "debug";
}

const CHAT_TAB = "chat";
const DEBUG_TAB = "debug";
const DEBUG_ROUTE_SEGMENT = "debug";
const THREADS_ROUTE_SEGMENT = "threads";
const CHAT_ROOT_PATH = "/";
const DEBUG_ROOT_PATH = "/debug";
const THREAD_ROUTE_PATH_PREFIX = "/threads/";
const DEBUG_ROUTE_PATH_SUFFIX = "/debug";

function buildRouteState(threadId: string | null, tab: "chat" | "debug"): ApplicationRouteState {
  return {
    threadId,
    tab,
  };
}

function buildNeutralRouteState(): ApplicationRouteState {
  return buildRouteState(null, CHAT_TAB);
}

// Empty or whitespace-only identifiers are treated as no-selection state to prevent
// invalid route ids from propagating into application-owned thread selection state.
function normalizeRouteThreadId(segment: string): string | null {
  try {
    const decodedThreadId = decodeURIComponent(segment).trim();
    return decodedThreadId.length > 0 ? decodedThreadId : null;
  } catch {
    return null;
  }
}

export class ApplicationRouteStateMapper {
  public parseFromPathname(pathname: string): ApplicationRouteState {
    const segments = pathname.split("/").filter((segment) => segment.length > 0);
    if (segments.length === 0) {
      return buildNeutralRouteState();
    }
    if (segments.length === 1 && segments[0] === DEBUG_ROUTE_SEGMENT) {
      return buildRouteState(null, DEBUG_TAB);
    }
    if (segments[0] === THREADS_ROUTE_SEGMENT && segments[1] !== undefined) {
      const threadId = normalizeRouteThreadId(segments[1]);
      if (threadId === null) {
        return buildNeutralRouteState();
      }
      if (segments[2] === DEBUG_ROUTE_SEGMENT) {
        return buildRouteState(threadId, DEBUG_TAB);
      }
      return buildRouteState(threadId, CHAT_TAB);
    }
    return buildNeutralRouteState();
  }

  public buildPath(state: ApplicationRouteState): string {
    const normalizedThreadId = state.threadId?.trim() ?? "";
    if (normalizedThreadId.length === 0) {
      return state.tab === DEBUG_TAB ? DEBUG_ROOT_PATH : CHAT_ROOT_PATH;
    }
    if (state.tab === DEBUG_TAB) {
      return `${THREAD_ROUTE_PATH_PREFIX}${encodeURIComponent(normalizedThreadId)}${DEBUG_ROUTE_PATH_SUFFIX}`;
    }
    return `${THREAD_ROUTE_PATH_PREFIX}${encodeURIComponent(normalizedThreadId)}`;
  }
}

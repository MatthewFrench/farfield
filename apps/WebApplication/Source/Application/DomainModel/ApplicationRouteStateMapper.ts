export interface ApplicationRouteState {
  threadId: string | null;
  tab: "chat" | "debug";
}

function decodeRouteThreadId(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

export class ApplicationRouteStateMapper {
  public parseFromPathname(pathname: string): ApplicationRouteState {
    const segments = pathname.split("/").filter((segment) => segment.length > 0);
    if (segments.length === 0) {
      return { threadId: null, tab: "chat" };
    }
    if (segments.length === 1 && segments[0] === "debug") {
      return { threadId: null, tab: "debug" };
    }
    if (segments[0] === "threads" && typeof segments[1] === "string" && segments[1].length > 0) {
      const threadId = decodeRouteThreadId(segments[1]);
      if (threadId === null) {
        return { threadId: null, tab: "chat" };
      }
      if (segments[2] === "debug") {
        return { threadId, tab: "debug" };
      }
      return { threadId, tab: "chat" };
    }
    return { threadId: null, tab: "chat" };
  }

  public buildPath(state: ApplicationRouteState): string {
    if (!state.threadId) {
      return state.tab === "debug" ? "/debug" : "/";
    }
    if (state.tab === "debug") {
      return `/threads/${encodeURIComponent(state.threadId)}/debug`;
    }
    return `/threads/${encodeURIComponent(state.threadId)}`;
  }
}

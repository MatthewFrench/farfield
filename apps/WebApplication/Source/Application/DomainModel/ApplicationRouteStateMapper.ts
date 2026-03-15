import {
  parseSettingsWorkspaceSection,
  type SettingsWorkspaceSection,
} from "@/Features/Settings/DomainModel/SettingsWorkspaceSectionContracts";

export interface ApplicationRouteState {
  threadId: string | null;
  tab: "chat" | "debug";
  settingsWorkspaceSection: SettingsWorkspaceSection;
}

const CHAT_TAB = "chat";
const DEBUG_TAB = "debug";
const DEBUG_ROUTE_SEGMENT = "debug";
const SETTINGS_ROUTE_SEGMENT = "settings";
const THREADS_ROUTE_SEGMENT = "threads";
const SETTINGS_TAB_QUERY_KEY = "tab";
const NOTIFICATIONS_SETTINGS_WORKSPACE_SECTION: SettingsWorkspaceSection = "notifications";
const DEBUG_SETTINGS_WORKSPACE_SECTION: SettingsWorkspaceSection = "debug";
const CHAT_ROOT_PATH = "/";
const SETTINGS_ROOT_PATH = "/settings";
const THREAD_ROUTE_PATH_PREFIX = "/threads/";
const SETTINGS_ROUTE_PATH_SUFFIX = "/settings";

function buildRouteState(
  threadId: string | null,
  tab: "chat" | "debug",
  settingsWorkspaceSection: SettingsWorkspaceSection,
): ApplicationRouteState {
  return {
    threadId,
    tab,
    settingsWorkspaceSection,
  };
}

function buildNeutralRouteState(): ApplicationRouteState {
  return buildRouteState(null, CHAT_TAB, NOTIFICATIONS_SETTINGS_WORKSPACE_SECTION);
}

function buildDebugRouteState(
  threadId: string | null,
  settingsWorkspaceSection: SettingsWorkspaceSection,
): ApplicationRouteState {
  return buildRouteState(threadId, DEBUG_TAB, settingsWorkspaceSection);
}

function readSettingsWorkspaceSectionFromSearch(search: string): SettingsWorkspaceSection {
  const searchParameters = new URLSearchParams(search);
  const sectionValue = searchParameters.get(SETTINGS_TAB_QUERY_KEY);
  if (sectionValue === null) {
    return NOTIFICATIONS_SETTINGS_WORKSPACE_SECTION;
  }
  try {
    return parseSettingsWorkspaceSection(sectionValue);
  } catch {
    return NOTIFICATIONS_SETTINGS_WORKSPACE_SECTION;
  }
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
  public parseFromLocation(pathname: string, search: string): ApplicationRouteState {
    const segments = pathname.split("/").filter((segment) => segment.length > 0);
    if (segments.length === 0) {
      return buildNeutralRouteState();
    }
    if (segments.length === 1 && segments[0] === DEBUG_ROUTE_SEGMENT) {
      return buildDebugRouteState(null, DEBUG_SETTINGS_WORKSPACE_SECTION);
    }
    if (segments.length === 1 && segments[0] === SETTINGS_ROUTE_SEGMENT) {
      return buildDebugRouteState(null, readSettingsWorkspaceSectionFromSearch(search));
    }
    if (segments[0] === THREADS_ROUTE_SEGMENT && segments[1] !== undefined) {
      const threadId = normalizeRouteThreadId(segments[1]);
      if (threadId === null) {
        return buildNeutralRouteState();
      }
      if (segments[2] === DEBUG_ROUTE_SEGMENT) {
        return buildDebugRouteState(threadId, DEBUG_SETTINGS_WORKSPACE_SECTION);
      }
      if (segments[2] === SETTINGS_ROUTE_SEGMENT) {
        return buildDebugRouteState(threadId, readSettingsWorkspaceSectionFromSearch(search));
      }
      return buildRouteState(threadId, CHAT_TAB, NOTIFICATIONS_SETTINGS_WORKSPACE_SECTION);
    }
    return buildNeutralRouteState();
  }

  public parseFromPathname(pathname: string): ApplicationRouteState {
    return this.parseFromLocation(pathname, "");
  }

  public buildPath(state: ApplicationRouteState): string {
    const normalizedThreadId = state.threadId?.trim() ?? "";
    if (state.tab === DEBUG_TAB) {
      const encodedSettingsWorkspaceSection = encodeURIComponent(state.settingsWorkspaceSection);
      if (normalizedThreadId.length === 0) {
        return `${SETTINGS_ROOT_PATH}?${SETTINGS_TAB_QUERY_KEY}=${encodedSettingsWorkspaceSection}`;
      }
      return `${THREAD_ROUTE_PATH_PREFIX}${encodeURIComponent(normalizedThreadId)}${SETTINGS_ROUTE_PATH_SUFFIX}?${SETTINGS_TAB_QUERY_KEY}=${encodedSettingsWorkspaceSection}`;
    }
    if (normalizedThreadId.length === 0) {
      return CHAT_ROOT_PATH;
    }
    return `${THREAD_ROUTE_PATH_PREFIX}${encodeURIComponent(normalizedThreadId)}`;
  }
}

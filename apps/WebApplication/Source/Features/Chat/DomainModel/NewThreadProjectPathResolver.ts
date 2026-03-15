import { type ThreadProjectGroup } from "@/Features/Threads/DomainModel/ThreadGroupTypes";

export const MISSING_NEW_THREAD_PROJECT_PATH_ERROR_MESSAGE =
  "Cannot start a new thread from chat: choose a project from the sidebar first.";
export const AMBIGUOUS_NEW_THREAD_PROJECT_PATH_ERROR_MESSAGE =
  "Cannot start a new thread from chat: multiple project contexts are available. Create the thread from a specific project in the sidebar.";

type NewThreadProjectPathResolutionSource =
  | "currentProjectContext"
  | "selectedAgentProjectDirectory"
  | "activeProjectGroup";

interface ResolvedNewThreadProjectPathResolution {
  status: "resolved";
  projectPath: string;
  source: NewThreadProjectPathResolutionSource;
}

interface MissingNewThreadProjectPathResolution {
  status: "missing";
  message: typeof MISSING_NEW_THREAD_PROJECT_PATH_ERROR_MESSAGE;
}

interface AmbiguousNewThreadProjectPathResolution {
  status: "ambiguous";
  message: typeof AMBIGUOUS_NEW_THREAD_PROJECT_PATH_ERROR_MESSAGE;
}

export type NewThreadProjectPathResolution =
  | ResolvedNewThreadProjectPathResolution
  | MissingNewThreadProjectPathResolution
  | AmbiguousNewThreadProjectPathResolution;

export interface ResolveNewThreadProjectPathInput {
  activeProjectGroups: ThreadProjectGroup[];
  selectedAgentProjectDirectories: readonly string[];
}

function readDistinctNormalizedProjectPaths(projectPaths: readonly string[]): string[] {
  const distinctProjectPathSet = new Set<string>();
  for (const projectPath of projectPaths) {
    const normalizedProjectPath = projectPath.trim();
    if (normalizedProjectPath.length === 0) {
      continue;
    }
    distinctProjectPathSet.add(normalizedProjectPath);
  }
  return Array.from(distinctProjectPathSet);
}

function readDistinctActiveProjectPaths(activeProjectGroups: ThreadProjectGroup[]): string[] {
  const activeProjectPaths: string[] = [];
  for (const activeProjectGroup of activeProjectGroups) {
    if (activeProjectGroup.projectPath === null) {
      continue;
    }
    activeProjectPaths.push(activeProjectGroup.projectPath);
  }
  return readDistinctNormalizedProjectPaths(activeProjectPaths);
}

/**
 * Resolves the only acceptable project path for creating a brand-new thread from the chat pane.
 * This owner refuses ambiguous project context so the composer never silently creates in the wrong workspace.
 */
export function resolveNewThreadProjectPath(
  input: ResolveNewThreadProjectPathInput,
): NewThreadProjectPathResolution {
  const selectedAgentProjectDirectories = readDistinctNormalizedProjectPaths(
    input.selectedAgentProjectDirectories,
  );
  if (selectedAgentProjectDirectories.length === 1) {
    const selectedAgentProjectDirectory = selectedAgentProjectDirectories[0];
    if (selectedAgentProjectDirectory === undefined) {
      throw new Error("Expected a selected agent project directory to exist.");
    }
    return {
      status: "resolved",
      projectPath: selectedAgentProjectDirectory,
      source: "selectedAgentProjectDirectory",
    };
  }

  const activeProjectPaths = readDistinctActiveProjectPaths(input.activeProjectGroups);
  if (activeProjectPaths.length === 1) {
    const activeProjectPath = activeProjectPaths[0];
    if (activeProjectPath === undefined) {
      throw new Error("Expected an active project path to exist.");
    }
    return {
      status: "resolved",
      projectPath: activeProjectPath,
      source: "activeProjectGroup",
    };
  }

  if (selectedAgentProjectDirectories.length > 1 || activeProjectPaths.length > 1) {
    return {
      status: "ambiguous",
      message: AMBIGUOUS_NEW_THREAD_PROJECT_PATH_ERROR_MESSAGE,
    };
  }

  return {
    status: "missing",
    message: MISSING_NEW_THREAD_PROJECT_PATH_ERROR_MESSAGE,
  };
}

import {
  type NewThreadProjectPathResolution,
  resolveNewThreadProjectPath,
} from "@/Features/Chat/DomainModel/NewThreadProjectPathResolver";
import { ThreadComposerProjectContextPreferenceStore } from "../DataAccess/ThreadComposerProjectContextPreferenceStore";
import { type ThreadProjectGroup } from "../DomainModel/ThreadGroupTypes";

export interface ResolveThreadComposerProjectContextInput {
  activeProjectGroups: ThreadProjectGroup[];
  selectedAgentProjectDirectories: readonly string[];
}

function normalizeProjectPath(projectPath: string | null | undefined): string | null {
  if (projectPath === null || projectPath === undefined) {
    return null;
  }
  const normalizedProjectPath = projectPath.trim();
  return normalizedProjectPath.length > 0 ? normalizedProjectPath : null;
}

function readDistinctNormalizedProjectPaths(projectPaths: readonly string[]): string[] {
  const normalizedProjectPathSet = new Set<string>();
  for (const projectPath of projectPaths) {
    const normalizedProjectPath = normalizeProjectPath(projectPath);
    if (normalizedProjectPath === null) {
      continue;
    }
    normalizedProjectPathSet.add(normalizedProjectPath);
  }
  return Array.from(normalizedProjectPathSet);
}

/**
 * Owns the explicit current project context used by composer-driven thread creation.
 * The owner keeps project choice sticky across chat interactions while refusing stale
 * project paths that no longer match the selected agent's declared project directories.
 */
export class ThreadComposerProjectContextStateOwner {
  private currentProjectPath: string | null;
  private readonly threadComposerProjectContextPreferenceStore: ThreadComposerProjectContextPreferenceStore;

  public constructor(
    threadComposerProjectContextPreferenceStore = new ThreadComposerProjectContextPreferenceStore(),
  ) {
    this.currentProjectPath = null;
    this.threadComposerProjectContextPreferenceStore = threadComposerProjectContextPreferenceStore;
  }

  public writeCurrentProjectPath(projectPath: string): void {
    this.currentProjectPath = normalizeProjectPath(projectPath);
    try {
      if (this.currentProjectPath === null) {
        this.threadComposerProjectContextPreferenceStore.clearProjectContext();
        return;
      }
      this.threadComposerProjectContextPreferenceStore.writeProjectContext(this.currentProjectPath);
    } catch {
      // Preference persistence is best-effort; keep the in-memory context authoritative.
    }
  }

  public clearCurrentProjectPath(): void {
    this.currentProjectPath = null;
    try {
      this.threadComposerProjectContextPreferenceStore.clearProjectContext();
    } catch {
      // Clearing persistence is best-effort; the in-memory context is already cleared.
    }
  }

  public readCurrentProjectPath(): string | null {
    if (this.currentProjectPath === null) {
      try {
        this.currentProjectPath =
          this.threadComposerProjectContextPreferenceStore.readProjectContext();
      } catch {
        return null;
      }
    }
    return this.currentProjectPath;
  }

  public resolveProjectPath(
    input: ResolveThreadComposerProjectContextInput,
  ): NewThreadProjectPathResolution {
    const currentProjectPath = this.readCurrentProjectPath();
    if (currentProjectPath !== null) {
      return {
        status: "resolved",
        projectPath: currentProjectPath,
        source: "currentProjectContext",
      };
    }

    return resolveNewThreadProjectPath({
      activeProjectGroups: input.activeProjectGroups,
      selectedAgentProjectDirectories: readDistinctNormalizedProjectPaths(
        input.selectedAgentProjectDirectories,
      ),
    });
  }
}

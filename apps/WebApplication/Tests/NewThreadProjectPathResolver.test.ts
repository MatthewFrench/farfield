import { describe, expect, it } from "vitest";
import {
  AMBIGUOUS_NEW_THREAD_PROJECT_PATH_ERROR_MESSAGE,
  MISSING_NEW_THREAD_PROJECT_PATH_ERROR_MESSAGE,
  resolveNewThreadProjectPath,
} from "@/Features/Chat/DomainModel/NewThreadProjectPathResolver";
import { type ThreadProjectGroup } from "@/Features/Threads/DomainModel/ThreadGroupTypes";

function createActiveProjectGroup(projectPath: string | null): ThreadProjectGroup {
  return {
    key: projectPath ?? "__no_project__",
    label: projectPath ?? "No Project",
    projectPath,
    projectCreatedAt: 1,
    latestUpdatedAt: 1,
    threads: [],
    isRemoved: false,
  };
}

describe("NewThreadProjectPathResolver", () => {
  it("prefers the selected agent single project directory", () => {
    const resolution = resolveNewThreadProjectPath({
      activeProjectGroups: [
        createActiveProjectGroup("/workspace/alpha"),
        createActiveProjectGroup("/workspace/beta"),
      ],
      selectedAgentProjectDirectories: ["/workspace/selected"],
    });

    expect(resolution).toEqual({
      status: "resolved",
      projectPath: "/workspace/selected",
      source: "selectedAgentProjectDirectory",
    });
  });

  it("uses the only active project group when the selected agent does not expose one project directory", () => {
    const resolution = resolveNewThreadProjectPath({
      activeProjectGroups: [createActiveProjectGroup("/workspace/alpha")],
      selectedAgentProjectDirectories: [],
    });

    expect(resolution).toEqual({
      status: "resolved",
      projectPath: "/workspace/alpha",
      source: "activeProjectGroup",
    });
  });

  it("returns an ambiguous error when multiple project contexts remain", () => {
    const resolution = resolveNewThreadProjectPath({
      activeProjectGroups: [
        createActiveProjectGroup("/workspace/alpha"),
        createActiveProjectGroup("/workspace/beta"),
      ],
      selectedAgentProjectDirectories: ["/workspace/alpha", "/workspace/beta"],
    });

    expect(resolution).toEqual({
      status: "ambiguous",
      message: AMBIGUOUS_NEW_THREAD_PROJECT_PATH_ERROR_MESSAGE,
    });
  });

  it("returns a missing error when no project context is available", () => {
    const resolution = resolveNewThreadProjectPath({
      activeProjectGroups: [createActiveProjectGroup(null)],
      selectedAgentProjectDirectories: [],
    });

    expect(resolution).toEqual({
      status: "missing",
      message: MISSING_NEW_THREAD_PROJECT_PATH_ERROR_MESSAGE,
    });
  });
});

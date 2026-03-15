import { describe, expect, it } from "vitest";
import { type ThreadProjectGroup } from "@/Features/Threads/DomainModel/ThreadGroupTypes";
import { ThreadComposerProjectContextStateOwner } from "@/Features/Threads/StateManagement/ThreadComposerProjectContextStateOwner";

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

describe("ThreadComposerProjectContextStateOwner", () => {
  it("returns the stored current project path when it remains valid for the selected agent", () => {
    const owner = new ThreadComposerProjectContextStateOwner();
    owner.writeCurrentProjectPath("/workspace/current");

    const resolution = owner.resolveProjectPath({
      activeProjectGroups: [createActiveProjectGroup("/workspace/alpha")],
      selectedAgentProjectDirectories: ["/workspace/current"],
    });

    expect(resolution).toEqual({
      status: "resolved",
      projectPath: "/workspace/current",
      source: "currentProjectContext",
    });
  });

  it("keeps the stored current project path authoritative even when selected-agent directories differ", () => {
    const owner = new ThreadComposerProjectContextStateOwner();
    owner.writeCurrentProjectPath("/workspace/stale");

    const resolution = owner.resolveProjectPath({
      activeProjectGroups: [createActiveProjectGroup("/workspace/alpha")],
      selectedAgentProjectDirectories: ["/workspace/alpha"],
    });

    expect(resolution).toEqual({
      status: "resolved",
      projectPath: "/workspace/stale",
      source: "currentProjectContext",
    });
  });

  it("falls back to the regular resolver when no explicit current project is stored", () => {
    const owner = new ThreadComposerProjectContextStateOwner();

    const resolution = owner.resolveProjectPath({
      activeProjectGroups: [createActiveProjectGroup("/workspace/alpha")],
      selectedAgentProjectDirectories: [],
    });

    expect(resolution).toEqual({
      status: "resolved",
      projectPath: "/workspace/alpha",
      source: "activeProjectGroup",
    });
  });
});

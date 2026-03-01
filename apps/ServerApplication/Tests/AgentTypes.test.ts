import { describe, expect, it } from "vitest";
import {
  type AgentDescriptor,
  type AgentId,
  AgentIdentifierByName,
  AgentIdentifierValues,
  type AgentListThreadsInput,
  type AgentThreadListSortKey,
  AgentThreadListSortKeyByName,
  AgentThreadListSortKeyValues,
  AgentThreadLiveStateErrorKindByName,
} from "../Source/Agents/Types.js";

function createDescriptor(id: AgentId): AgentDescriptor {
  return {
    id,
    label: id,
    enabled: true,
    connected: true,
    capabilities: {
      canListModels: false,
      canListCollaborationModes: false,
      canReadConfigRequirements: false,
      canListExperimentalFeatures: false,
      canListMcpServerStatuses: false,
      canListApps: false,
      canListSkills: false,
      canReadAccount: false,
      canReadAccountRateLimits: false,
      canExecuteCommand: false,
      canStartAccountLogin: false,
      canCancelAccountLogin: false,
      canLogoutAccount: false,
      canReloadMcpServerConfig: false,
      canStartMcpServerOauthLogin: false,
      canWriteSkillsConfig: false,
      canSetCollaborationMode: false,
      canSubmitUserInput: false,
      canReadLiveState: false,
      canReadStreamEvents: false,
    },
    projectDirectories: [],
  };
}

function createListThreadsInput(sortKey: AgentThreadListSortKey): AgentListThreadsInput {
  return {
    limit: 20,
    archived: false,
    all: false,
    maxPages: 1,
    cursor: null,
    sortKey,
    cwd: null,
  };
}

describe("Agent type literal owners", () => {
  it("keeps canonical agent identifiers in one exported owner", () => {
    expect(AgentIdentifierByName).toEqual({
      codex: "codex",
      opencode: "opencode",
    });
    expect(AgentIdentifierValues).toEqual(["codex", "opencode"]);

    const descriptors = AgentIdentifierValues.map((id) => createDescriptor(id));
    expect(descriptors.map((descriptor) => descriptor.id)).toEqual(AgentIdentifierValues);
  });

  it("keeps canonical thread list sort keys in one exported owner", () => {
    expect(AgentThreadListSortKeyByName).toEqual({
      createdAt: "created_at",
      updatedAt: "updated_at",
    });
    expect(AgentThreadListSortKeyValues).toEqual(["created_at", "updated_at"]);

    const createdAtInput = createListThreadsInput(AgentThreadListSortKeyByName.createdAt);
    const updatedAtInput = createListThreadsInput(AgentThreadListSortKeyByName.updatedAt);
    expect(createdAtInput.sortKey).toBe("created_at");
    expect(updatedAtInput.sortKey).toBe("updated_at");
  });

  it("keeps live-state error kind literal under the agent contracts owner", () => {
    expect(AgentThreadLiveStateErrorKindByName).toEqual({
      reductionFailed: "reductionFailed",
    });
  });
});

import os from "node:os";
import path from "node:path";
import { AppServerRpcError } from "@farfield/api";
import { describe, expect, it } from "vitest";
import {
  CodexAgentAdapter,
  type CodexAgentOptions,
} from "../Source/Agents/Adapters/CodexAgentAdapter.js";

const DEFAULT_WORKSPACE_DIRECTORY = "/tmp/farfield-codex-adapter-workspace";
const INVALID_STREAM_EVENT_LOG_FILE_PATH = path.join(
  os.tmpdir(),
  `farfield-codex-agent-adapter-invalid-events-${String(process.pid)}.ndjson`,
);
const SOCKET_FILE_PATH = path.join(
  os.tmpdir(),
  `farfield-codex-agent-adapter-${String(process.pid)}.sock`,
);

function createAdapter(options: Partial<CodexAgentOptions> = {}): CodexAgentAdapter {
  return new CodexAgentAdapter({
    appExecutable: "codex",
    appServerBaseEnvironment: process.env,
    socketPath: SOCKET_FILE_PATH,
    invalidStreamEventsLogPath: INVALID_STREAM_EVENT_LOG_FILE_PATH,
    workspaceDir: DEFAULT_WORKSPACE_DIRECTORY,
    userAgent: "farfield-tests",
    reconnectDelayMs: 1_000,
    ...options,
  });
}

describe("CodexAgentAdapter", () => {
  it("exposes the expected codex adapter descriptor metadata", () => {
    const adapter = createAdapter();

    expect(adapter.id).toBe("codex");
    expect(adapter.label).toBe("Codex");
    expect(adapter.capabilities).toEqual({
      canListModels: true,
      canListCollaborationModes: true,
      canReadConfigRequirements: true,
      canListExperimentalFeatures: true,
      canListMcpServerStatuses: true,
      canListApps: true,
      canListSkills: true,
      canReadAccount: true,
      canReadAccountRateLimits: true,
      canExecuteCommand: true,
      canStartAccountLogin: true,
      canCancelAccountLogin: true,
      canLogoutAccount: true,
      canReloadMcpServerConfig: true,
      canStartMcpServerOauthLogin: true,
      canWriteConfigValue: true,
      canWriteSkillsConfig: true,
      canSetCollaborationMode: true,
      canSubmitUserInput: true,
      canReadLiveState: true,
      canReadStreamEvents: true,
    });
  });

  it("classifies thread-not-loaded invalid-request rpc errors", () => {
    const adapter = createAdapter();

    expect(adapter.isThreadNotLoadedError(new AppServerRpcError(-32600, "thread not loaded"))).toBe(
      true,
    );
    expect(
      adapter.isThreadNotLoadedError(new AppServerRpcError(-32600, "conversation not found")),
    ).toBe(false);
    expect(adapter.isThreadNotLoadedError(new AppServerRpcError(-32601, "thread not loaded"))).toBe(
      false,
    );
    expect(adapter.isThreadNotLoadedError(new Error("thread not loaded"))).toBe(false);
  });

  it("classifies conversation-not-found invalid-request rpc errors", () => {
    const adapter = createAdapter();

    expect(
      adapter.isConversationNotFoundError(new AppServerRpcError(-32600, "conversation not found")),
    ).toBe(true);
    expect(
      adapter.isConversationNotFoundError(new AppServerRpcError(-32600, "thread not loaded")),
    ).toBe(false);
    expect(
      adapter.isConversationNotFoundError(new AppServerRpcError(-32601, "conversation not found")),
    ).toBe(false);
    expect(adapter.isConversationNotFoundError(new Error("conversation not found"))).toBe(false);
  });

  it("returns the adapter workspace as the project directory list", async () => {
    const adapter = createAdapter({
      workspaceDir: "/tmp/custom-workspace",
    });

    await expect(adapter.listProjectDirectories()).resolves.toEqual(["/tmp/custom-workspace"]);
  });
});

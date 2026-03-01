import { cleanup, render, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CapabilityServerClient } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import { type DebugWorkspaceSection } from "@/Features/Debugging/DomainModel/DebugWorkspaceSectionContracts";
import {
  type DebugAppServerCoverageDiagnostics,
  useDebugAppServerCoverageDiagnostics,
} from "@/Features/Debugging/StateManagement/UseDebugAppServerCoverageDiagnostics";

interface HarnessProperties {
  debugWorkspaceSection: DebugWorkspaceSection;
  capabilityServerClient: CapabilityServerClient;
  onDiagnosticsChange: (diagnostics: DebugAppServerCoverageDiagnostics) => void;
}

function Harness(properties: HarnessProperties): React.JSX.Element {
  const diagnostics = useDebugAppServerCoverageDiagnostics({
    debugWorkspaceSection: properties.debugWorkspaceSection,
    capabilityServerClient: properties.capabilityServerClient,
  });
  properties.onDiagnosticsChange(diagnostics);
  return createElement("div", {
    "data-testid": "debug-coverage-diagnostics-harness",
  });
}

afterEach(() => {
  cleanup();
});

describe("useDebugAppServerCoverageDiagnostics", () => {
  it("loads diagnostics when coverage section is active", async () => {
    const capabilityServerClient = new CapabilityServerClient();
    const readConfigRequirements = vi
      .spyOn(capabilityServerClient, "readConfigRequirements")
      .mockResolvedValue({
        ok: true,
        requirements: null,
      });
    const readAccount = vi.spyOn(capabilityServerClient, "readAccount").mockResolvedValue({
      ok: true,
      account: null,
      requiresOpenaiAuth: false,
    });
    const readAuthStatus = vi.spyOn(capabilityServerClient, "readAuthStatus").mockResolvedValue({
      ok: true,
      authMethod: null,
      authToken: null,
      requiresOpenaiAuth: null,
    });
    const readAccountRateLimits = vi
      .spyOn(capabilityServerClient, "readAccountRateLimits")
      .mockResolvedValue({
        ok: true,
        rateLimits: null,
        rateLimitsByLimitId: null,
      });
    const readUserInfo = vi.spyOn(capabilityServerClient, "readUserInfo").mockResolvedValue({
      ok: true,
      allegedUserEmail: null,
    });
    const listExperimentalFeatures = vi
      .spyOn(capabilityServerClient, "listExperimentalFeatures")
      .mockResolvedValue({
        ok: true,
        data: [],
        nextCursor: null,
      });
    const listMcpServers = vi.spyOn(capabilityServerClient, "listMcpServers").mockResolvedValue({
      ok: true,
      data: [],
      nextCursor: null,
    });
    const listApps = vi.spyOn(capabilityServerClient, "listApps").mockResolvedValue({
      ok: true,
      data: [],
      nextCursor: null,
    });
    const listSkills = vi.spyOn(capabilityServerClient, "listSkills").mockResolvedValue({
      ok: true,
      data: [],
    });
    const listRemoteSkills = vi
      .spyOn(capabilityServerClient, "listRemoteSkills")
      .mockResolvedValue({
        ok: true,
        data: [],
      });

    const latestDiagnostics: { current: DebugAppServerCoverageDiagnostics | null } = {
      current: null,
    };

    render(
      createElement(Harness, {
        debugWorkspaceSection: "coverage",
        capabilityServerClient,
        onDiagnosticsChange: (diagnostics) => {
          latestDiagnostics.current = diagnostics;
        },
      }),
    );

    await waitFor(() => {
      expect(latestDiagnostics.current?.coverageDiagnosticsSnapshot).not.toBeNull();
    });

    expect(readConfigRequirements).toHaveBeenCalledTimes(1);
    expect(readAccount).toHaveBeenCalledTimes(1);
    expect(readAuthStatus).toHaveBeenCalledTimes(1);
    expect(readAccountRateLimits).toHaveBeenCalledTimes(1);
    expect(readUserInfo).toHaveBeenCalledTimes(1);
    expect(listExperimentalFeatures).toHaveBeenCalledTimes(1);
    expect(listMcpServers).toHaveBeenCalledTimes(1);
    expect(listApps).toHaveBeenCalledTimes(1);
    expect(listSkills).toHaveBeenCalledTimes(1);
    expect(listRemoteSkills).toHaveBeenCalledTimes(1);
  });

  it("runs account and mcp coverage actions through capability client owners", async () => {
    const capabilityServerClient = new CapabilityServerClient();
    const openWindow = vi.spyOn(window, "open").mockImplementation(() => null);
    vi.spyOn(capabilityServerClient, "readConfigRequirements").mockResolvedValue({
      ok: true,
      requirements: null,
    });
    vi.spyOn(capabilityServerClient, "readAccount").mockResolvedValue({
      ok: true,
      account: null,
      requiresOpenaiAuth: true,
    });
    vi.spyOn(capabilityServerClient, "readAuthStatus").mockResolvedValue({
      ok: true,
      authMethod: "chatgpt",
      authToken: null,
      requiresOpenaiAuth: true,
    });
    vi.spyOn(capabilityServerClient, "readAccountRateLimits").mockResolvedValue({
      ok: true,
      rateLimits: null,
      rateLimitsByLimitId: null,
    });
    vi.spyOn(capabilityServerClient, "readUserInfo").mockResolvedValue({
      ok: true,
      allegedUserEmail: "dev@example.com",
    });
    vi.spyOn(capabilityServerClient, "listExperimentalFeatures").mockResolvedValue({
      ok: true,
      data: [],
      nextCursor: null,
    });
    vi.spyOn(capabilityServerClient, "listMcpServers").mockResolvedValue({
      ok: true,
      data: [],
      nextCursor: null,
    });
    vi.spyOn(capabilityServerClient, "listApps").mockResolvedValue({
      ok: true,
      data: [],
      nextCursor: null,
    });
    vi.spyOn(capabilityServerClient, "listSkills").mockResolvedValue({
      ok: true,
      data: [],
    });
    vi.spyOn(capabilityServerClient, "listRemoteSkills").mockResolvedValue({
      ok: true,
      data: [],
    });
    const startAccountLogin = vi
      .spyOn(capabilityServerClient, "startAccountLogin")
      .mockResolvedValue({
        ok: true,
        type: "chatgpt",
        loginId: "login-1",
        authUrl: "https://example.com/oauth/start",
      });
    const cancelAccountLogin = vi
      .spyOn(capabilityServerClient, "cancelAccountLogin")
      .mockResolvedValue({
        ok: true,
        status: "canceled",
      });
    const logoutAccount = vi.spyOn(capabilityServerClient, "logoutAccount").mockResolvedValue({
      ok: true,
    });
    const reloadMcpServerConfig = vi
      .spyOn(capabilityServerClient, "reloadMcpServerConfig")
      .mockResolvedValue({
        ok: true,
      });
    const startMcpServerOauthLogin = vi
      .spyOn(capabilityServerClient, "startMcpServerOauthLogin")
      .mockResolvedValue({
        ok: true,
        authorizationUrl: "https://example.com/oauth/mcp/github",
      });
    const executeCommand = vi.spyOn(capabilityServerClient, "executeCommand").mockResolvedValue({
      ok: true,
      exitCode: 0,
      stdout: "/tmp/project\n",
      stderr: "",
    });
    const readGitDiffToRemote = vi
      .spyOn(capabilityServerClient, "readGitDiffToRemote")
      .mockResolvedValue({
        ok: true,
        sha: "abc123def456",
        diff: "diff --git a/file.ts b/file.ts",
      });
    const searchFuzzyFiles = vi
      .spyOn(capabilityServerClient, "searchFuzzyFiles")
      .mockResolvedValue({
        ok: true,
        files: [
          {
            root: "/tmp/project",
            path: "apps/WebApplication/Source/Main.tsx",
            fileName: "Main.tsx",
            score: 0.94,
            indices: [0, 1, 2],
          },
        ],
      });
    const startFuzzyFileSearchSession = vi
      .spyOn(capabilityServerClient, "startFuzzyFileSearchSession")
      .mockResolvedValue({
        ok: true,
      });
    const updateFuzzyFileSearchSession = vi
      .spyOn(capabilityServerClient, "updateFuzzyFileSearchSession")
      .mockResolvedValue({
        ok: true,
      });
    const stopFuzzyFileSearchSession = vi
      .spyOn(capabilityServerClient, "stopFuzzyFileSearchSession")
      .mockResolvedValue({
        ok: true,
      });
    const writeConfigValue = vi
      .spyOn(capabilityServerClient, "writeConfigValue")
      .mockResolvedValue({
        ok: true,
        status: "okOverridden",
        version: "v2",
        filePath: "/tmp/project/.codex/config.toml",
        overriddenMetadata: {
          message: "Workspace layer overrides parent configuration.",
          overridingLayer: "workspace",
          effectiveValue: {
            enabled: true,
          },
        },
      });
    const writeConfigBatch = vi
      .spyOn(capabilityServerClient, "writeConfigBatch")
      .mockResolvedValue({
        ok: true,
        status: "ok",
        version: "v3",
        filePath: "/tmp/project/.codex/config.toml",
        overriddenMetadata: null,
      });
    const writeSkillsConfig = vi
      .spyOn(capabilityServerClient, "writeSkillsConfig")
      .mockResolvedValue({
        ok: true,
        effectiveEnabled: false,
      });
    const exportRemoteSkill = vi
      .spyOn(capabilityServerClient, "exportRemoteSkill")
      .mockResolvedValue({
        ok: true,
        id: "remote-skill-1",
        path: "/tmp/project/.codex/skills/repository-checks/SKILL.md",
      });
    const detectExternalAgentConfig = vi
      .spyOn(capabilityServerClient, "detectExternalAgentConfig")
      .mockResolvedValue({
        ok: true,
        items: [
          {
            itemType: "AGENTS_MD",
            description: "Migrate AGENTS.md from ~/.claude",
            cwd: null,
          },
          {
            itemType: "CONFIG",
            description: "Import repository config",
            cwd: "/tmp/project",
          },
        ],
      });
    const importExternalAgentConfig = vi
      .spyOn(capabilityServerClient, "importExternalAgentConfig")
      .mockResolvedValue({
        ok: true,
      });
    const startThreadRealtime = vi
      .spyOn(capabilityServerClient, "startThreadRealtime")
      .mockResolvedValue({
        ok: true,
      });
    const appendThreadRealtimeAudio = vi
      .spyOn(capabilityServerClient, "appendThreadRealtimeAudio")
      .mockResolvedValue({
        ok: true,
      });
    const appendThreadRealtimeText = vi
      .spyOn(capabilityServerClient, "appendThreadRealtimeText")
      .mockResolvedValue({
        ok: true,
      });
    const stopThreadRealtime = vi
      .spyOn(capabilityServerClient, "stopThreadRealtime")
      .mockResolvedValue({
        ok: true,
      });
    const startWindowsSandboxSetup = vi
      .spyOn(capabilityServerClient, "startWindowsSandboxSetup")
      .mockResolvedValue({
        ok: true,
        started: true,
      });
    const uploadFeedback = vi.spyOn(capabilityServerClient, "uploadFeedback").mockResolvedValue({
      ok: true,
      threadId: "thread-coverage-feedback",
    });
    const readThreadStreamEvents = vi
      .spyOn(capabilityServerClient, "readThreadStreamEvents")
      .mockResolvedValue({
        ok: true,
        threadId: "thread-realtime-1",
        ownerClientId: "client-coverage",
        events: [
          {
            type: "broadcast",
            method: "turn/completed",
            sourceClientId: "client-codex",
            params: {
              sequence: 7,
              receivedAtMilliseconds: 17_200,
              note: "done",
            },
          },
        ],
        nextSequence: 8,
        firstAvailableSequence: 3,
        resetRequired: false,
      });
    const readNotificationEvents = vi
      .spyOn(capabilityServerClient, "readNotificationEvents")
      .mockImplementation(async (input) => {
        if (input.limit === 320) {
          return {
            ok: true,
            events: [
              {
                sequence: 24,
                method: "error",
                params: {
                  error: {
                    message: "Rate limit exceeded",
                    codexErrorInfo: "usageLimitExceeded",
                    additionalDetails: "Try again after reset.",
                  },
                  willRetry: true,
                  threadId: "thread-realtime-1",
                  turnId: "turn-11",
                },
                receivedAtMilliseconds: 17_780,
              },
            ],
            nextSequence: 25,
            firstAvailableSequence: 3,
            resetRequired: false,
          };
        }

        if (input.limit === 300) {
          return {
            ok: true,
            events: [
              {
                sequence: 21,
                method: "thread/name/updated",
                params: {
                  threadId: "thread-realtime-1",
                  threadName: "Release Planning",
                },
                receivedAtMilliseconds: 17_750,
              },
              {
                sequence: 22,
                method: "thread/archived",
                params: {
                  threadId: "thread-legacy-1",
                },
                receivedAtMilliseconds: 17_760,
              },
              {
                sequence: 23,
                method: "thread/unarchived",
                params: {
                  threadId: "thread-legacy-1",
                },
                receivedAtMilliseconds: 17_770,
              },
            ],
            nextSequence: 24,
            firstAvailableSequence: 3,
            resetRequired: false,
          };
        }

        if (input.limit === 280) {
          return {
            ok: true,
            events: [
              {
                sequence: 18,
                method: "configWarning",
                params: {
                  summary: "Deprecated key in config",
                  details: "Use model.default instead.",
                  path: "/tmp/project/.codex/config.toml",
                  range: {
                    start: {
                      line: 4,
                      column: 5,
                    },
                    end: {
                      line: 4,
                      column: 22,
                    },
                  },
                },
                receivedAtMilliseconds: 17_720,
              },
              {
                sequence: 19,
                method: "deprecationNotice",
                params: {
                  summary: "Legacy shell command mode is deprecated",
                  details: "Migrate to the command execution block interface.",
                },
                receivedAtMilliseconds: 17_730,
              },
              {
                sequence: 20,
                method: "windows/worldWritableWarning",
                params: {
                  samplePaths: ["/tmp/project", "/tmp/project/cache"],
                  extraCount: 3,
                  failedScan: false,
                },
                receivedAtMilliseconds: 17_740,
              },
            ],
            nextSequence: 21,
            firstAvailableSequence: 3,
            resetRequired: false,
          };
        }

        if (input.limit === 260) {
          return {
            ok: true,
            events: [
              {
                sequence: 17,
                method: "model/rerouted",
                params: {
                  threadId: "thread-realtime-1",
                  turnId: "turn-9",
                  fromModel: "gpt-5",
                  toModel: "gpt-5-mini",
                  reason: "highRiskCyberActivity",
                },
                receivedAtMilliseconds: 17_710,
              },
            ],
            nextSequence: 18,
            firstAvailableSequence: 3,
            resetRequired: false,
          };
        }

        if (input.limit === 240) {
          return {
            ok: true,
            events: [
              {
                sequence: 15,
                method: "fuzzyFileSearch/sessionUpdated",
                params: {
                  sessionId: "fuzzy-session-1",
                  query: "main",
                  files: [
                    {
                      root: "/tmp/project",
                      path: "apps/WebApplication/Source/Main.tsx",
                      fileName: "Main.tsx",
                      score: 0.91,
                      indices: [0, 1],
                    },
                  ],
                },
                receivedAtMilliseconds: 17_690,
              },
              {
                sequence: 16,
                method: "fuzzyFileSearch/sessionCompleted",
                params: {
                  sessionId: "fuzzy-session-1",
                },
                receivedAtMilliseconds: 17_695,
              },
            ],
            nextSequence: 17,
            firstAvailableSequence: 3,
            resetRequired: false,
          };
        }

        if (input.limit === 220) {
          return {
            ok: true,
            events: [
              {
                sequence: 14,
                method: "serverRequest/resolved",
                params: {
                  threadId: "thread-realtime-1",
                  requestId: 13,
                },
                receivedAtMilliseconds: 17_680,
              },
            ],
            nextSequence: 15,
            firstAvailableSequence: 3,
            resetRequired: false,
          };
        }

        if (input.limit === 200) {
          return {
            ok: true,
            events: [
              {
                sequence: 12,
                method: "mcpServer/oauthLogin/completed",
                params: {
                  name: "github",
                  success: true,
                },
                receivedAtMilliseconds: 17_600,
              },
              {
                sequence: 13,
                method: "account/login/completed",
                params: {
                  loginId: "login-1",
                  success: false,
                  error: "User canceled login.",
                },
                receivedAtMilliseconds: 17_650,
              },
            ],
            nextSequence: 14,
            firstAvailableSequence: 3,
            resetRequired: false,
          };
        }

        return {
          ok: true,
          events: [
            {
              sequence: 11,
              method: "turn/started",
              params: {
                threadId: "thread-realtime-1",
                detail: "started",
              },
              receivedAtMilliseconds: 17_500,
            },
          ],
          nextSequence: 12,
          firstAvailableSequence: 3,
          resetRequired: false,
        };
      });
    const readPendingServerRequests = vi
      .spyOn(capabilityServerClient, "readPendingServerRequests")
      .mockResolvedValue({
        ok: true,
        requests: [
          {
            requestId: 13,
            method: "item/tool/requestUserInput",
            params: {
              question: "Select deployment target",
            },
            receivedAtMilliseconds: 17_700,
          },
        ],
      });

    const latestDiagnostics: { current: DebugAppServerCoverageDiagnostics | null } = {
      current: null,
    };

    render(
      createElement(Harness, {
        debugWorkspaceSection: "coverage",
        capabilityServerClient,
        onDiagnosticsChange: (diagnostics) => {
          latestDiagnostics.current = diagnostics;
        },
      }),
    );

    await waitFor(() => {
      expect(latestDiagnostics.current?.coverageDiagnosticsSnapshot).not.toBeNull();
    });

    latestDiagnostics.current?.startAccountLogin();
    await waitFor(() => {
      expect(startAccountLogin).toHaveBeenCalledTimes(1);
      expect(latestDiagnostics.current?.pendingAccountLogin?.loginId).toBe("login-1");
    });

    latestDiagnostics.current?.cancelAccountLogin();
    await waitFor(() => {
      expect(cancelAccountLogin).toHaveBeenCalledTimes(1);
    });

    latestDiagnostics.current?.logoutAccount();
    latestDiagnostics.current?.reloadMcpServerConfig();
    latestDiagnostics.current?.startMcpServerOauthLogin("github");
    latestDiagnostics.current?.writeConfigValue(
      "integrations.github",
      '{"enabled":true}',
      "upsert",
      "/tmp/project/.codex/config.toml",
      "v1",
    );
    latestDiagnostics.current?.writeConfigBatch(
      '[{\"keyPath\":\"integrations.github.enabled\",\"value\":true,\"mergeStrategy\":\"replace\"}]',
      "/tmp/project/.codex/config.toml",
      "v2",
    );
    latestDiagnostics.current?.readGitDiffToRemote("/tmp/project");
    latestDiagnostics.current?.searchFuzzyFiles("main", ["/tmp/project"], "token-1");
    latestDiagnostics.current?.startFuzzyFileSearchSession("fuzzy-session-1", ["/tmp/project"]);
    latestDiagnostics.current?.updateFuzzyFileSearchSession("fuzzy-session-1", "main");
    latestDiagnostics.current?.stopFuzzyFileSearchSession("fuzzy-session-1");
    latestDiagnostics.current?.executeCommand(["pwd"], 1200, "/tmp/project");
    latestDiagnostics.current?.writeSkillsConfig(
      "/tmp/project/.codex/skills/checks/SKILL.md",
      false,
    );
    latestDiagnostics.current?.exportRemoteSkill("remote-skill-1");
    latestDiagnostics.current?.detectExternalAgentConfig(true, ["/tmp/project"]);
    latestDiagnostics.current?.importExternalAgentConfig([
      {
        itemType: "AGENTS_MD",
        description: "Migrate AGENTS.md from ~/.claude",
        cwd: null,
      },
    ]);
    latestDiagnostics.current?.startThreadRealtime(
      "thread-realtime-1",
      "Summarize the project status.",
      "session-coverage-1",
    );
    latestDiagnostics.current?.appendThreadRealtimeAudio("thread-realtime-1", {
      data: "YmFzZTY0LWF1ZGlv",
      sampleRate: 16000,
      numChannels: 1,
      samplesPerChannel: 640,
    });
    latestDiagnostics.current?.appendThreadRealtimeText(
      "thread-realtime-1",
      "Continue with implementation details.",
    );
    latestDiagnostics.current?.stopThreadRealtime("thread-realtime-1");
    latestDiagnostics.current?.readThreadStreamEvents("thread-realtime-1", 7);
    latestDiagnostics.current?.readNotificationEvents(7);
    latestDiagnostics.current?.readAuthCompletionEvents(12);
    latestDiagnostics.current?.readServerRequestResolvedEvents(13);
    latestDiagnostics.current?.readFuzzySessionNotifications(14);
    latestDiagnostics.current?.readModelReroutedEvents(16);
    latestDiagnostics.current?.readWarningNotifications(18);
    latestDiagnostics.current?.readThreadLifecycleNotifications(21);
    latestDiagnostics.current?.readErrorNotifications(24);
    latestDiagnostics.current?.readPendingServerRequests();
    latestDiagnostics.current?.startWindowsSandboxSetup("unelevated");
    latestDiagnostics.current?.uploadFeedback(
      "quality",
      true,
      "Coverage validation from debug surface.",
      "thread-1",
    );
    await waitFor(() => {
      expect(logoutAccount).toHaveBeenCalledTimes(1);
      expect(reloadMcpServerConfig).toHaveBeenCalledTimes(1);
      expect(startMcpServerOauthLogin).toHaveBeenCalledWith({
        actionName: "debug-coverage-action",
        name: "github",
      });
      expect(executeCommand).toHaveBeenCalledWith({
        actionName: "debug-coverage-action",
        command: ["pwd"],
        timeoutMs: 1200,
        cwd: "/tmp/project",
      });
      expect(readGitDiffToRemote).toHaveBeenCalledWith({
        actionName: "debug-coverage-action",
        cwd: "/tmp/project",
      });
      expect(searchFuzzyFiles).toHaveBeenCalledWith({
        actionName: "debug-coverage-action",
        query: "main",
        roots: ["/tmp/project"],
        cancellationToken: "token-1",
      });
      expect(startFuzzyFileSearchSession).toHaveBeenCalledWith({
        actionName: "debug-coverage-action",
        sessionId: "fuzzy-session-1",
        roots: ["/tmp/project"],
      });
      expect(updateFuzzyFileSearchSession).toHaveBeenCalledWith({
        actionName: "debug-coverage-action",
        sessionId: "fuzzy-session-1",
        query: "main",
      });
      expect(stopFuzzyFileSearchSession).toHaveBeenCalledWith({
        actionName: "debug-coverage-action",
        sessionId: "fuzzy-session-1",
      });
      expect(writeConfigValue).toHaveBeenCalledWith({
        actionName: "debug-coverage-action",
        keyPath: "integrations.github",
        value: {
          enabled: true,
        },
        mergeStrategy: "upsert",
        filePath: "/tmp/project/.codex/config.toml",
        expectedVersion: "v1",
      });
      expect(writeConfigBatch).toHaveBeenCalledWith({
        actionName: "debug-coverage-action",
        edits: [
          {
            keyPath: "integrations.github.enabled",
            value: true,
            mergeStrategy: "replace",
          },
        ],
        filePath: "/tmp/project/.codex/config.toml",
        expectedVersion: "v2",
      });
      expect(writeSkillsConfig).toHaveBeenCalledWith({
        actionName: "debug-coverage-action",
        path: "/tmp/project/.codex/skills/checks/SKILL.md",
        enabled: false,
      });
      expect(exportRemoteSkill).toHaveBeenCalledWith({
        actionName: "debug-coverage-action",
        hazelnutId: "remote-skill-1",
      });
      expect(detectExternalAgentConfig).toHaveBeenCalledWith({
        actionName: "debug-coverage-action",
        includeHome: true,
        cwds: ["/tmp/project"],
      });
      expect(importExternalAgentConfig).toHaveBeenCalledWith({
        actionName: "debug-coverage-action",
        migrationItems: [
          {
            itemType: "AGENTS_MD",
            description: "Migrate AGENTS.md from ~/.claude",
            cwd: null,
          },
        ],
      });
      expect(startThreadRealtime).toHaveBeenCalledWith({
        actionName: "debug-coverage-action",
        threadId: "thread-realtime-1",
        prompt: "Summarize the project status.",
        sessionId: "session-coverage-1",
      });
      expect(appendThreadRealtimeAudio).toHaveBeenCalledWith({
        actionName: "debug-coverage-action",
        threadId: "thread-realtime-1",
        audio: {
          data: "YmFzZTY0LWF1ZGlv",
          sampleRate: 16000,
          numChannels: 1,
          samplesPerChannel: 640,
        },
      });
      expect(appendThreadRealtimeText).toHaveBeenCalledWith({
        actionName: "debug-coverage-action",
        threadId: "thread-realtime-1",
        text: "Continue with implementation details.",
      });
      expect(stopThreadRealtime).toHaveBeenCalledWith({
        actionName: "debug-coverage-action",
        threadId: "thread-realtime-1",
      });
      expect(readThreadStreamEvents).toHaveBeenCalledWith({
        actionName: "debug-coverage-action",
        threadId: "thread-realtime-1",
        sinceSequence: 7,
      });
      expect(readNotificationEvents).toHaveBeenCalledWith({
        actionName: "debug-coverage-action",
        sinceSequence: 7,
      });
      expect(readNotificationEvents).toHaveBeenCalledWith({
        actionName: "debug-coverage-action",
        sinceSequence: 12,
        limit: 200,
      });
      expect(readNotificationEvents).toHaveBeenCalledWith({
        actionName: "debug-coverage-action",
        sinceSequence: 13,
        limit: 220,
      });
      expect(readNotificationEvents).toHaveBeenCalledWith({
        actionName: "debug-coverage-action",
        sinceSequence: 14,
        limit: 240,
      });
      expect(readNotificationEvents).toHaveBeenCalledWith({
        actionName: "debug-coverage-action",
        sinceSequence: 16,
        limit: 260,
      });
      expect(readNotificationEvents).toHaveBeenCalledWith({
        actionName: "debug-coverage-action",
        sinceSequence: 18,
        limit: 280,
      });
      expect(readNotificationEvents).toHaveBeenCalledWith({
        actionName: "debug-coverage-action",
        sinceSequence: 21,
        limit: 300,
      });
      expect(readNotificationEvents).toHaveBeenCalledWith({
        actionName: "debug-coverage-action",
        sinceSequence: 24,
        limit: 320,
      });
      expect(readPendingServerRequests).toHaveBeenCalledWith({
        actionName: "debug-coverage-action",
      });
      expect(startWindowsSandboxSetup).toHaveBeenCalledWith({
        actionName: "debug-coverage-action",
        mode: "unelevated",
      });
      expect(uploadFeedback).toHaveBeenCalledWith({
        actionName: "debug-coverage-action",
        classification: "quality",
        includeLogs: true,
        reason: "Coverage validation from debug surface.",
        threadId: "thread-1",
      });
      expect(openWindow).toHaveBeenCalledWith(
        "https://example.com/oauth/mcp/github",
        "_blank",
        "noopener,noreferrer",
      );
      expect(latestDiagnostics.current?.lastCommandExecutionResult).toEqual({
        command: ["pwd"],
        exitCode: 0,
        stdout: "/tmp/project\n",
        stderr: "",
        executedAtIso8601: expect.any(String),
      });
      expect(latestDiagnostics.current?.lastConfigValueWriteResult).toEqual({
        keyPath: "integrations.github",
        mergeStrategy: "upsert",
        valueSummary: '{"enabled":true}',
        status: "okOverridden",
        version: "v2",
        filePath: "/tmp/project/.codex/config.toml",
        overriddenMessage: "Workspace layer overrides parent configuration.",
        writtenAtIso8601: expect.any(String),
      });
      expect(latestDiagnostics.current?.lastConfigBatchWriteResult).toEqual({
        editCount: 1,
        status: "ok",
        version: "v3",
        filePath: "/tmp/project/.codex/config.toml",
        overriddenMessage: null,
        writtenAtIso8601: expect.any(String),
      });
      expect(latestDiagnostics.current?.lastFeedbackUploadResult).toEqual({
        classification: "quality",
        includeLogs: true,
        reason: "Coverage validation from debug surface.",
        requestedThreadId: "thread-1",
        reportedThreadId: "thread-coverage-feedback",
        uploadedAtIso8601: expect.any(String),
      });
      expect(latestDiagnostics.current?.lastGitDiffToRemoteResult).toEqual({
        cwd: "/tmp/project",
        sha: "abc123def456",
        diff: "diff --git a/file.ts b/file.ts",
        readAtIso8601: expect.any(String),
      });
      expect(latestDiagnostics.current?.lastFuzzyFileSearchResult).toEqual({
        query: "main",
        roots: ["/tmp/project"],
        files: [
          {
            root: "/tmp/project",
            path: "apps/WebApplication/Source/Main.tsx",
            fileName: "Main.tsx",
            score: 0.94,
            indices: [0, 1, 2],
          },
        ],
        searchedAtIso8601: expect.any(String),
      });
      expect(latestDiagnostics.current?.lastFuzzyFileSearchSessionStartResult).toEqual({
        sessionId: "fuzzy-session-1",
        roots: ["/tmp/project"],
        startedAtIso8601: expect.any(String),
      });
      expect(latestDiagnostics.current?.lastFuzzyFileSearchSessionUpdateResult).toEqual({
        sessionId: "fuzzy-session-1",
        query: "main",
        updatedAtIso8601: expect.any(String),
      });
      expect(latestDiagnostics.current?.lastFuzzyFileSearchSessionStopResult).toEqual({
        sessionId: "fuzzy-session-1",
        stoppedAtIso8601: expect.any(String),
      });
      expect(latestDiagnostics.current?.lastExternalAgentConfigDetectResult).toEqual({
        includeHome: true,
        cwds: ["/tmp/project"],
        items: [
          {
            itemType: "AGENTS_MD",
            description: "Migrate AGENTS.md from ~/.claude",
            cwd: null,
          },
          {
            itemType: "CONFIG",
            description: "Import repository config",
            cwd: "/tmp/project",
          },
        ],
        detectedAtIso8601: expect.any(String),
      });
      expect(latestDiagnostics.current?.lastExternalAgentConfigImportResult).toEqual({
        itemCount: 1,
        importedAtIso8601: expect.any(String),
      });
      expect(latestDiagnostics.current?.lastThreadRealtimeStartResult).toEqual({
        threadId: "thread-realtime-1",
        prompt: "Summarize the project status.",
        sessionId: "session-coverage-1",
        startedAtIso8601: expect.any(String),
      });
      expect(latestDiagnostics.current?.lastThreadRealtimeAppendAudioResult).toEqual({
        threadId: "thread-realtime-1",
        audio: {
          data: "YmFzZTY0LWF1ZGlv",
          sampleRate: 16000,
          numChannels: 1,
          samplesPerChannel: 640,
        },
        appendedAtIso8601: expect.any(String),
      });
      expect(latestDiagnostics.current?.lastThreadRealtimeAppendTextResult).toEqual({
        threadId: "thread-realtime-1",
        text: "Continue with implementation details.",
        appendedAtIso8601: expect.any(String),
      });
      expect(latestDiagnostics.current?.lastThreadRealtimeStopResult).toEqual({
        threadId: "thread-realtime-1",
        stoppedAtIso8601: expect.any(String),
      });
      expect(latestDiagnostics.current?.lastThreadStreamEventsResult).toEqual({
        threadId: "thread-realtime-1",
        sinceSequence: 7,
        ownerClientId: "client-coverage",
        eventCount: 1,
        nextSequence: 8,
        firstAvailableSequence: 3,
        resetRequired: false,
        methodCounts: [
          {
            method: "turn/completed",
            count: 1,
          },
        ],
        events: [
          {
            frameType: "broadcast",
            method: "turn/completed",
            requestId: null,
            sourceClientId: "client-codex",
            sequence: 7,
            receivedAtMilliseconds: 17_200,
            preview: expect.stringContaining('"note": "done"'),
          },
        ],
        readAtIso8601: expect.any(String),
      });
      expect(latestDiagnostics.current?.lastNotificationEventsResult).toEqual({
        sinceSequence: 7,
        eventCount: 1,
        nextSequence: 12,
        firstAvailableSequence: 3,
        resetRequired: false,
        methodCounts: [
          {
            method: "turn/started",
            count: 1,
          },
        ],
        events: [
          {
            method: "turn/started",
            sequence: 11,
            receivedAtMilliseconds: 17_500,
            preview: expect.stringContaining('"detail": "started"'),
          },
        ],
        readAtIso8601: expect.any(String),
      });
      expect(latestDiagnostics.current?.lastAuthCompletionEventsResult).toEqual({
        sinceSequence: 12,
        eventCount: 2,
        nextSequence: 14,
        firstAvailableSequence: 3,
        resetRequired: false,
        methodCounts: [
          {
            method: "account/login/completed",
            count: 1,
          },
          {
            method: "mcpServer/oauthLogin/completed",
            count: 1,
          },
        ],
        events: [
          {
            method: "mcpServer/oauthLogin/completed",
            sequence: 12,
            receivedAtMilliseconds: 17_600,
            status: "success",
            subject: "github",
            errorMessage: null,
          },
          {
            method: "account/login/completed",
            sequence: 13,
            receivedAtMilliseconds: 17_650,
            status: "error",
            subject: "login-1",
            errorMessage: "User canceled login.",
          },
        ],
        readAtIso8601: expect.any(String),
      });
      expect(latestDiagnostics.current?.lastServerRequestResolvedEventsResult).toEqual({
        sinceSequence: 13,
        eventCount: 1,
        nextSequence: 15,
        firstAvailableSequence: 3,
        resetRequired: false,
        events: [
          {
            sequence: 14,
            requestId: 13,
            threadId: "thread-realtime-1",
            receivedAtMilliseconds: 17_680,
          },
        ],
        readAtIso8601: expect.any(String),
      });
      expect(latestDiagnostics.current?.lastFuzzySessionNotificationsResult).toEqual({
        sinceSequence: 14,
        eventCount: 2,
        nextSequence: 17,
        firstAvailableSequence: 3,
        resetRequired: false,
        methodCounts: [
          {
            method: "fuzzyFileSearch/sessionCompleted",
            count: 1,
          },
          {
            method: "fuzzyFileSearch/sessionUpdated",
            count: 1,
          },
        ],
        events: [
          {
            method: "fuzzyFileSearch/sessionUpdated",
            sequence: 15,
            sessionId: "fuzzy-session-1",
            query: "main",
            fileCount: 1,
            receivedAtMilliseconds: 17_690,
          },
          {
            method: "fuzzyFileSearch/sessionCompleted",
            sequence: 16,
            sessionId: "fuzzy-session-1",
            query: null,
            fileCount: null,
            receivedAtMilliseconds: 17_695,
          },
        ],
        readAtIso8601: expect.any(String),
      });
      expect(latestDiagnostics.current?.lastModelReroutedEventsResult).toEqual({
        sinceSequence: 16,
        eventCount: 1,
        nextSequence: 18,
        firstAvailableSequence: 3,
        resetRequired: false,
        events: [
          {
            sequence: 17,
            threadId: "thread-realtime-1",
            turnId: "turn-9",
            fromModel: "gpt-5",
            toModel: "gpt-5-mini",
            reason: "highRiskCyberActivity",
            receivedAtMilliseconds: 17_710,
          },
        ],
        readAtIso8601: expect.any(String),
      });
      expect(latestDiagnostics.current?.lastWarningNotificationsResult).toEqual({
        sinceSequence: 18,
        eventCount: 3,
        nextSequence: 21,
        firstAvailableSequence: 3,
        resetRequired: false,
        methodCounts: [
          {
            method: "configWarning",
            count: 1,
          },
          {
            method: "deprecationNotice",
            count: 1,
          },
          {
            method: "windows/worldWritableWarning",
            count: 1,
          },
        ],
        events: [
          {
            method: "configWarning",
            sequence: 18,
            summary: "Deprecated key in config",
            details: "Use model.default instead.",
            path: "/tmp/project/.codex/config.toml",
            range: {
              start: {
                line: 4,
                column: 5,
              },
              end: {
                line: 4,
                column: 22,
              },
            },
            receivedAtMilliseconds: 17_720,
          },
          {
            method: "deprecationNotice",
            sequence: 19,
            summary: "Legacy shell command mode is deprecated",
            details: "Migrate to the command execution block interface.",
            receivedAtMilliseconds: 17_730,
          },
          {
            method: "windows/worldWritableWarning",
            sequence: 20,
            samplePaths: ["/tmp/project", "/tmp/project/cache"],
            extraCount: 3,
            failedScan: false,
            receivedAtMilliseconds: 17_740,
          },
        ],
        readAtIso8601: expect.any(String),
      });
      expect(latestDiagnostics.current?.lastThreadLifecycleNotificationsResult).toEqual({
        sinceSequence: 21,
        eventCount: 3,
        nextSequence: 24,
        firstAvailableSequence: 3,
        resetRequired: false,
        methodCounts: [
          {
            method: "thread/archived",
            count: 1,
          },
          {
            method: "thread/name/updated",
            count: 1,
          },
          {
            method: "thread/unarchived",
            count: 1,
          },
        ],
        events: [
          {
            method: "thread/name/updated",
            sequence: 21,
            threadId: "thread-realtime-1",
            threadName: "Release Planning",
            receivedAtMilliseconds: 17_750,
          },
          {
            method: "thread/archived",
            sequence: 22,
            threadId: "thread-legacy-1",
            threadName: null,
            receivedAtMilliseconds: 17_760,
          },
          {
            method: "thread/unarchived",
            sequence: 23,
            threadId: "thread-legacy-1",
            threadName: null,
            receivedAtMilliseconds: 17_770,
          },
        ],
        readAtIso8601: expect.any(String),
      });
      expect(latestDiagnostics.current?.lastErrorNotificationsResult).toEqual({
        sinceSequence: 24,
        eventCount: 1,
        retryCount: 1,
        nextSequence: 25,
        firstAvailableSequence: 3,
        resetRequired: false,
        events: [
          {
            sequence: 24,
            threadId: "thread-realtime-1",
            turnId: "turn-11",
            message: "Rate limit exceeded",
            codexErrorInfoSummary: "usageLimitExceeded",
            additionalDetails: "Try again after reset.",
            willRetry: true,
            receivedAtMilliseconds: 17_780,
          },
        ],
        readAtIso8601: expect.any(String),
      });
      expect(latestDiagnostics.current?.lastPendingServerRequestsResult).toEqual({
        requestCount: 1,
        requests: [
          {
            requestId: 13,
            method: "item/tool/requestUserInput",
            receivedAtMilliseconds: 17_700,
            preview: expect.stringContaining('"question": "Select deployment target"'),
          },
        ],
        methodCounts: [
          {
            method: "item/tool/requestUserInput",
            count: 1,
          },
        ],
        readAtIso8601: expect.any(String),
      });
      expect(latestDiagnostics.current?.lastWindowsSandboxSetupStartResult).toEqual({
        mode: "unelevated",
        started: true,
        startedAtIso8601: expect.any(String),
      });
    });

    openWindow.mockRestore();
  });
});

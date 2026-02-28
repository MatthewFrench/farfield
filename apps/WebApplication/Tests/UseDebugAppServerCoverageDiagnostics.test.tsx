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
    const readAccountRateLimits = vi
      .spyOn(capabilityServerClient, "readAccountRateLimits")
      .mockResolvedValue({
        ok: true,
        rateLimits: null,
        rateLimitsByLimitId: null,
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
    expect(readAccountRateLimits).toHaveBeenCalledTimes(1);
    expect(listExperimentalFeatures).toHaveBeenCalledTimes(1);
    expect(listMcpServers).toHaveBeenCalledTimes(1);
    expect(listApps).toHaveBeenCalledTimes(1);
    expect(listSkills).toHaveBeenCalledTimes(1);
  });

  it("runs account and mcp coverage actions through capability client owners", async () => {
    const capabilityServerClient = new CapabilityServerClient();
    vi.spyOn(capabilityServerClient, "readConfigRequirements").mockResolvedValue({
      ok: true,
      requirements: null,
    });
    vi.spyOn(capabilityServerClient, "readAccount").mockResolvedValue({
      ok: true,
      account: null,
      requiresOpenaiAuth: true,
    });
    vi.spyOn(capabilityServerClient, "readAccountRateLimits").mockResolvedValue({
      ok: true,
      rateLimits: null,
      rateLimitsByLimitId: null,
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
    await waitFor(() => {
      expect(logoutAccount).toHaveBeenCalledTimes(1);
      expect(reloadMcpServerConfig).toHaveBeenCalledTimes(1);
    });
  });
});

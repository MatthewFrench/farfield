import { cleanup, render, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type CapabilityServerClient } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
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
    const capabilityServerClient = {
      readConfigRequirements: vi.fn(async () => ({
        ok: true,
        requirements: null,
      })),
      listExperimentalFeatures: vi.fn(async () => ({
        ok: true,
        data: [],
        nextCursor: null,
      })),
      listMcpServers: vi.fn(async () => ({
        ok: true,
        data: [],
        nextCursor: null,
      })),
      listApps: vi.fn(async () => ({
        ok: true,
        data: [],
        nextCursor: null,
      })),
      listSkills: vi.fn(async () => ({
        ok: true,
        data: [],
      })),
    } as unknown as CapabilityServerClient;

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

    expect(capabilityServerClient.readConfigRequirements).toHaveBeenCalledTimes(1);
    expect(capabilityServerClient.listExperimentalFeatures).toHaveBeenCalledTimes(1);
    expect(capabilityServerClient.listMcpServers).toHaveBeenCalledTimes(1);
    expect(capabilityServerClient.listApps).toHaveBeenCalledTimes(1);
    expect(capabilityServerClient.listSkills).toHaveBeenCalledTimes(1);
  });
});

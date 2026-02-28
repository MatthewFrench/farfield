import { type JsonValue } from "@farfield/protocol";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CapabilityAppsResponse,
  CapabilityConfigRequirementsResponse,
  CapabilityExperimentalFeaturesResponse,
  CapabilityMcpServersResponse,
  CapabilityServerClient,
  CapabilitySkillsResponse,
} from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import { type DebugWorkspaceSection } from "@/Features/Debugging/DomainModel/DebugWorkspaceSectionContracts";
import {
  type DebugAppServerCoverageAppSummary,
  type DebugAppServerCoverageExperimentalFeature,
  type DebugAppServerCoverageMcpServerSummary,
  type DebugAppServerCoverageRequirements,
  type DebugAppServerCoverageSkillEntry,
  type DebugAppServerCoverageSnapshot,
} from "../DomainModel/DebugAppServerCoverageContracts";

const COVERAGE_WORKSPACE_SECTION: DebugWorkspaceSection = "coverage";

const COVERAGE_REQUEST_LIST_LIMIT = 100;
const COVERAGE_REQUEST_OPERATION_NAME = "debug-coverage-refresh";
const COVERAGE_ERROR_PREFIX = "Unable to load app-server coverage diagnostics: ";

export interface UseDebugAppServerCoverageDiagnosticsInput {
  debugWorkspaceSection: DebugWorkspaceSection;
  capabilityServerClient: CapabilityServerClient;
}

export interface DebugAppServerCoverageDiagnostics {
  isLoadingCoverageDiagnostics: boolean;
  coverageDiagnosticsErrorMessage: string;
  coverageDiagnosticsSnapshot: DebugAppServerCoverageSnapshot | null;
  refreshCoverageDiagnostics: () => void;
}

function toErrorMessage<ErrorType>(error: ErrorType): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}

function readAuthStatusLabel(authStatus: JsonValue): string {
  if (typeof authStatus === "string") {
    return authStatus;
  }
  if (authStatus === null) {
    return "null";
  }
  return JSON.stringify(authStatus);
}

function mapRequirements(
  requirements: CapabilityConfigRequirementsResponse["requirements"],
): DebugAppServerCoverageRequirements | null {
  if (requirements === null) {
    return null;
  }
  return {
    allowedApprovalPolicies: requirements.allowedApprovalPolicies,
    allowedSandboxModes: requirements.allowedSandboxModes,
    allowedWebSearchModes: requirements.allowedWebSearchModes,
    enforceResidency: requirements.enforceResidency,
    network: requirements.network,
  };
}

function mapExperimentalFeatures(
  data: CapabilityExperimentalFeaturesResponse["data"],
): DebugAppServerCoverageExperimentalFeature[] {
  return data.map((feature) => ({
    name: feature.name,
    stage: feature.stage,
    displayName: feature.displayName,
    description: feature.description,
    announcement: feature.announcement,
    enabled: feature.enabled,
    defaultEnabled: feature.defaultEnabled,
  }));
}

function mapMcpServers(
  data: CapabilityMcpServersResponse["data"],
): DebugAppServerCoverageMcpServerSummary[] {
  return data.map((server) => ({
    name: server.name,
    authStatus: readAuthStatusLabel(server.authStatus),
    toolCount: server.toolCount,
    resourceCount: server.resourceCount,
    resourceTemplateCount: server.resourceTemplateCount,
  }));
}

function mapApps(data: CapabilityAppsResponse["data"]): DebugAppServerCoverageAppSummary[] {
  return data.map((appInfo) => ({
    id: appInfo.id,
    name: appInfo.name,
    description: appInfo.description,
    isAccessible: appInfo.isAccessible,
    isEnabled: appInfo.isEnabled,
  }));
}

function mapSkills(data: CapabilitySkillsResponse["data"]): DebugAppServerCoverageSkillEntry[] {
  return data.map((entry) => ({
    cwd: entry.cwd,
    skills: entry.skills.map((skill) => ({
      name: skill.name,
      description: skill.description,
      scope: skill.scope,
      enabled: skill.enabled,
    })),
    errorCount: entry.errors.length,
  }));
}

/**
 * Owns read cadence for app-server coverage diagnostics rendered in Debug Workspace.
 * Request concurrency is sequenced with request serials so stale responses cannot overwrite fresh state.
 */
export function useDebugAppServerCoverageDiagnostics(
  input: UseDebugAppServerCoverageDiagnosticsInput,
): DebugAppServerCoverageDiagnostics {
  const [isLoadingCoverageDiagnostics, setIsLoadingCoverageDiagnostics] = useState(false);
  const [coverageDiagnosticsErrorMessage, setCoverageDiagnosticsErrorMessage] = useState("");
  const [coverageDiagnosticsSnapshot, setCoverageDiagnosticsSnapshot] =
    useState<DebugAppServerCoverageSnapshot | null>(null);
  const requestSerialRef = useRef(0);

  const refreshCoverageDiagnostics = useCallback(() => {
    const nextRequestSerial = requestSerialRef.current + 1;
    requestSerialRef.current = nextRequestSerial;
    setIsLoadingCoverageDiagnostics(true);
    setCoverageDiagnosticsErrorMessage("");

    void (async () => {
      try {
        const [
          configRequirementsResponse,
          experimentalFeaturesResponse,
          mcpServersResponse,
          appsResponse,
          skillsResponse,
        ] = await Promise.all([
          input.capabilityServerClient.readConfigRequirements({
            actionName: COVERAGE_REQUEST_OPERATION_NAME,
          }),
          input.capabilityServerClient.listExperimentalFeatures({
            actionName: COVERAGE_REQUEST_OPERATION_NAME,
            limit: COVERAGE_REQUEST_LIST_LIMIT,
          }),
          input.capabilityServerClient.listMcpServers({
            actionName: COVERAGE_REQUEST_OPERATION_NAME,
            limit: COVERAGE_REQUEST_LIST_LIMIT,
          }),
          input.capabilityServerClient.listApps({
            actionName: COVERAGE_REQUEST_OPERATION_NAME,
            limit: COVERAGE_REQUEST_LIST_LIMIT,
          }),
          input.capabilityServerClient.listSkills({
            actionName: COVERAGE_REQUEST_OPERATION_NAME,
          }),
        ]);

        if (requestSerialRef.current !== nextRequestSerial) {
          return;
        }

        setCoverageDiagnosticsSnapshot({
          requirements: mapRequirements(configRequirementsResponse.requirements),
          experimentalFeatures: mapExperimentalFeatures(experimentalFeaturesResponse.data),
          mcpServers: mapMcpServers(mcpServersResponse.data),
          apps: mapApps(appsResponse.data),
          skills: mapSkills(skillsResponse.data),
          refreshedAtIso8601: new Date().toISOString(),
        });
      } catch (error) {
        if (requestSerialRef.current !== nextRequestSerial) {
          return;
        }
        setCoverageDiagnosticsErrorMessage(`${COVERAGE_ERROR_PREFIX}${toErrorMessage(error)}`);
      } finally {
        if (requestSerialRef.current === nextRequestSerial) {
          setIsLoadingCoverageDiagnostics(false);
        }
      }
    })();
  }, [input.capabilityServerClient]);

  useEffect(() => {
    if (input.debugWorkspaceSection !== COVERAGE_WORKSPACE_SECTION) {
      return;
    }
    if (isLoadingCoverageDiagnostics || coverageDiagnosticsSnapshot !== null) {
      return;
    }
    refreshCoverageDiagnostics();
  }, [
    coverageDiagnosticsSnapshot,
    input.debugWorkspaceSection,
    isLoadingCoverageDiagnostics,
    refreshCoverageDiagnostics,
  ]);

  return {
    isLoadingCoverageDiagnostics,
    coverageDiagnosticsErrorMessage,
    coverageDiagnosticsSnapshot,
    refreshCoverageDiagnostics,
  };
}

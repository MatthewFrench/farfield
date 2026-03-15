import { readAgentConnectivityState } from "./ApplicationAgentCapabilityDerivation";
import { readSystemHealthStatus } from "./ApplicationSystemHealthDerivation";
import {
  type ApplicationDerivedState,
  type UseApplicationDerivedStateInput,
} from "./UseApplicationDerivedStateContracts";

export function readAgentConnectivityAndSystemHealth(
  input: Pick<ApplicationDerivedState, "agentsById"> & {
    health: UseApplicationDerivedStateInput["health"];
  },
): Pick<
  ApplicationDerivedState,
  "codexConfigured" | "openCodeConnected" | "allSystemsReady" | "hasAnySystemFailure"
> {
  const { codexConfigured, openCodeConnected } = readAgentConnectivityState({
    agentsById: input.agentsById,
  });
  const { allSystemsReady, hasAnySystemFailure } = readSystemHealthStatus({
    codexConfigured,
    openCodeConnected,
    health: input.health,
  });
  return {
    codexConfigured,
    openCodeConnected,
    allSystemsReady,
    hasAnySystemFailure,
  };
}

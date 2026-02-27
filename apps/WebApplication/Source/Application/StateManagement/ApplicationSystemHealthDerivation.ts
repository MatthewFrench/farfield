import {
  type SystemHealthStatus,
  type SystemHealthStatusInput,
} from "./UseApplicationDerivedStateContracts";

export function readSystemHealthStatus(input: SystemHealthStatusInput): SystemHealthStatus {
  const { codexConfigured, openCodeConnected, health } = input;

  if (!codexConfigured) {
    return {
      allSystemsReady: openCodeConnected,
      hasAnySystemFailure: !openCodeConnected,
    };
  }
  if (health === null) {
    return {
      allSystemsReady: false,
      hasAnySystemFailure: !openCodeConnected,
    };
  }

  return {
    allSystemsReady:
      health.state.appReady === true &&
      health.state.ipcConnected === true &&
      health.state.ipcInitialized === true,
    hasAnySystemFailure:
      health.state.appReady === false ||
      health.state.ipcConnected === false ||
      health.state.ipcInitialized === false,
  };
}

import { describe, expect, it } from "vitest";
import { AppServerClient } from "../Source/AppServerClient.js";
import { AppServerRpcError, DesktopIpcError } from "../Source/Errors.js";
import { DesktopIpcClient } from "../Source/IpcClient.js";
import { applyStrictPatchSequence, ThreadStreamReductionError } from "../Source/LiveState.js";
import { CodexMonitorService } from "../Source/Service.js";
import * as PublicApi from "../Source/Index.js";

const EXPECTED_RUNTIME_PUBLIC_API_KEYS = [
  "AppServerClient",
  "AppServerError",
  "AppServerRpcError",
  "AppServerTransportError",
  "ChildProcessAppServerTransport",
  "CodexMonitorService",
  "DesktopIpcClient",
  "DesktopIpcError",
  "StrictPatchSequenceError",
  "ThreadStreamReductionError",
  "applyStrictPatch",
  "applyStrictPatchSequence",
  "applyTrustedPatchSequence",
  "buildAppServerSpawnEnvironment",
  "findLatestTurnParamsTemplate",
  "isChildProcessAppServerTransportOptions",
  "reduceThreadStreamEvents"
];

describe("Index", () => {
  it("exposes only the explicit runtime package surface", () => {
    const runtimePublicApiKeys = Object.keys(PublicApi).sort();
    expect(runtimePublicApiKeys).toEqual(EXPECTED_RUNTIME_PUBLIC_API_KEYS.slice().sort());
  });

  it("re-exports owner implementations from package modules", () => {
    expect(PublicApi.AppServerClient).toBe(AppServerClient);
    expect(PublicApi.CodexMonitorService).toBe(CodexMonitorService);
    expect(PublicApi.DesktopIpcClient).toBe(DesktopIpcClient);
    expect(PublicApi.AppServerRpcError).toBe(AppServerRpcError);
    expect(PublicApi.DesktopIpcError).toBe(DesktopIpcError);
    expect(PublicApi.ThreadStreamReductionError).toBe(ThreadStreamReductionError);
    expect(PublicApi.applyStrictPatchSequence).toBe(applyStrictPatchSequence);
  });
});

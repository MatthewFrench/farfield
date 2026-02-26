/**
 * Package public API boundary.
 * Re-exports stay explicit so new internal module exports do not silently widen package contracts.
 */
export { AppServerClient } from "./AppServerClient.js";
export type { ListThreadsAllOptions, ListThreadsOptions, StartThreadOptions } from "./AppServerClient.js";

export {
  buildAppServerSpawnEnvironment,
  ChildProcessAppServerTransport,
  isChildProcessAppServerTransportOptions
} from "./AppServerTransport.js";
export type {
  AppServerTransport,
  BuildAppServerSpawnEnvironmentInput,
  ChildProcessAppServerTransportOptions
} from "./AppServerTransport.js";

export {
  AppServerError,
  AppServerRpcError,
  AppServerTransportError,
  DesktopIpcError
} from "./Errors.js";
export type { CodexInterfaceAdapterError, CodexInterfaceAdapterErrorCategory } from "./Errors.js";

export { DesktopIpcClient } from "./IpcClient.js";
export type {
  DesktopIpcClientOptions,
  IpcConnectionListener,
  IpcConnectionState,
  IpcFrameListener,
  SendRequestOptions
} from "./IpcClient.js";

export {
  applyStrictPatch,
  applyStrictPatchSequence,
  applyTrustedPatchSequence,
  findLatestTurnParamsTemplate,
  reduceThreadStreamEvents,
  StrictPatchSequenceError,
  ThreadStreamReductionError
} from "./LiveState.js";
export type { ThreadStreamDerivedState, ThreadStreamReductionErrorDetails } from "./LiveState.js";

export { CodexMonitorService } from "./Service.js";
export type {
  CodexMonitorIpcClient,
  InterruptInput,
  SendMessageInput,
  SetModeInput,
  SubmitUserInputInput,
  ThreadFollowerRequestOptions
} from "./Service.js";

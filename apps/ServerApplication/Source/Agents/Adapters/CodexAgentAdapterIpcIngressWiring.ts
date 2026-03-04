import type { IpcConnectionState } from "@farfield/api";
import type { IpcFrame } from "@farfield/protocol";
import {
  type CodexIpcFrameEvent,
  INBOUND_IPC_FRAME_DIRECTION,
} from "./CodexAgentAdapterContracts.js";
import type { CodexIpcFrameDescription } from "./CodexThreadStreamStateOwner.js";

export interface CodexAgentAdapterIpcClient {
  onConnectionState: (listener: (state: IpcConnectionState) => void) => () => void;
  onFrame: (listener: (frame: IpcFrame) => void) => () => void;
}

export interface CodexAgentAdapterIpcConnectionLifecycleOwner {
  handleIpcConnectionState: (state: IpcConnectionState) => void;
}

export interface CodexAgentAdapterIpcThreadStreamStateOwner {
  describeFrame: (frame: IpcFrame) => CodexIpcFrameDescription;
  ingestInboundFrame: (frame: IpcFrame) => void;
}

interface CodexAgentAdapterIpcIngressWiringInput {
  ipcClient: CodexAgentAdapterIpcClient;
  connectionLifecycleOwner: CodexAgentAdapterIpcConnectionLifecycleOwner;
  threadStreamStateOwner: CodexAgentAdapterIpcThreadStreamStateOwner;
  emitIpcFrame: (event: CodexIpcFrameEvent) => void;
}

/**
 * Owns inbound IPC ingress wiring between transport events and stream-state owners.
 */
export function wireCodexAgentAdapterIpcIngress(
  input: CodexAgentAdapterIpcIngressWiringInput,
): void {
  input.ipcClient.onConnectionState((state) => {
    input.connectionLifecycleOwner.handleIpcConnectionState(state);
  });

  input.ipcClient.onFrame((frame) => {
    const frameDescription = input.threadStreamStateOwner.describeFrame(frame);

    // Ingest first so downstream observers can read current live-state/stream projections.
    input.threadStreamStateOwner.ingestInboundFrame(frame);
    input.emitIpcFrame({
      direction: INBOUND_IPC_FRAME_DIRECTION,
      frame,
      method: frameDescription.method,
      threadId: frameDescription.threadId,
    });
  });
}

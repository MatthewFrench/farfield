import type { DesktopIpcClient } from "@farfield/api";
import {
  type CodexIpcFrameEvent,
  INBOUND_IPC_FRAME_DIRECTION,
} from "./CodexAgentAdapterContracts.js";
import type { CodexConnectionLifecycleOwner } from "./CodexConnectionLifecycleOwner.js";
import type { CodexThreadStreamStateOwner } from "./CodexThreadStreamStateOwner.js";

interface CodexAgentAdapterIpcIngressWiringInput {
  ipcClient: DesktopIpcClient;
  connectionLifecycleOwner: CodexConnectionLifecycleOwner;
  threadStreamStateOwner: CodexThreadStreamStateOwner;
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

    input.emitIpcFrame({
      direction: INBOUND_IPC_FRAME_DIRECTION,
      frame,
      method: frameDescription.method,
      threadId: frameDescription.threadId,
    });
    input.threadStreamStateOwner.ingestInboundFrame(frame);
  });
}

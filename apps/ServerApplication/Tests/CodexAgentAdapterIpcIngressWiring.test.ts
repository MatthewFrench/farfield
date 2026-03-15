import type { IpcFrame } from "@farfield/protocol";
import { describe, expect, it } from "vitest";
import {
  type CodexAgentAdapterIpcClient,
  type CodexAgentAdapterIpcConnectionLifecycleOwner,
  type CodexAgentAdapterIpcThreadStreamStateOwner,
  wireCodexAgentAdapterIpcIngress,
} from "../Source/Agents/Adapters/CodexAgentAdapterIpcIngressWiring.js";
import { THREAD_STREAM_STATE_CHANGED_METHOD } from "../Source/Agents/ThreadStreamStateChangedContract.js";

const DEFAULT_THREAD_IDENTIFIER = "thread-1";
const SOURCE_CLIENT_IDENTIFIER = "client-source";

function createThreadStreamStateChangedFrame(threadId: string): IpcFrame {
  return {
    type: "broadcast",
    method: THREAD_STREAM_STATE_CHANGED_METHOD,
    params: {
      conversationId: threadId,
    },
    sourceClientId: SOURCE_CLIENT_IDENTIFIER,
    version: 1,
  };
}

class FakeIpcClient implements CodexAgentAdapterIpcClient {
  private connectionStateListener:
    | ((state: { connected: boolean; reason?: string }) => void)
    | null = null;
  private frameListener: ((frame: IpcFrame) => void) | null = null;

  public onConnectionState(
    listener: (state: { connected: boolean; reason?: string }) => void,
  ): () => void {
    this.connectionStateListener = listener;
    return () => {
      this.connectionStateListener = null;
    };
  }

  public onFrame(listener: (frame: IpcFrame) => void): () => void {
    this.frameListener = listener;
    return () => {
      this.frameListener = null;
    };
  }

  public emitConnectionState(state: { connected: boolean; reason?: string }): void {
    this.connectionStateListener?.(state);
  }

  public emitFrame(frame: IpcFrame): void {
    this.frameListener?.(frame);
  }
}

describe("wireCodexAgentAdapterIpcIngress", () => {
  it("ingests inbound frame state before emitting frame events", () => {
    const callOrder: string[] = [];
    const emittedThreadIdentifiers: Array<string | null> = [];
    let ingestedThreadIdentifier: string | null = null;

    const ipcClient = new FakeIpcClient();
    const connectionLifecycleOwner: CodexAgentAdapterIpcConnectionLifecycleOwner = {
      handleIpcConnectionState: () => {},
    };
    const threadStreamStateOwner: CodexAgentAdapterIpcThreadStreamStateOwner = {
      describeFrame: () => ({
        method: THREAD_STREAM_STATE_CHANGED_METHOD,
        threadId: DEFAULT_THREAD_IDENTIFIER,
      }),
      ingestInboundFrame: (frame) => {
        callOrder.push("ingest");
        if (frame.type !== "broadcast") {
          return;
        }
        ingestedThreadIdentifier =
          typeof frame.params.conversationId === "string" ? frame.params.conversationId : null;
      },
    };

    wireCodexAgentAdapterIpcIngress({
      ipcClient,
      connectionLifecycleOwner,
      threadStreamStateOwner,
      emitIpcFrame: (event) => {
        callOrder.push("emit");
        emittedThreadIdentifiers.push(event.threadId);
        expect(ingestedThreadIdentifier).toBe(DEFAULT_THREAD_IDENTIFIER);
      },
    });

    ipcClient.emitFrame(createThreadStreamStateChangedFrame(DEFAULT_THREAD_IDENTIFIER));

    expect(callOrder).toEqual(["ingest", "emit"]);
    expect(emittedThreadIdentifiers).toEqual([DEFAULT_THREAD_IDENTIFIER]);
  });

  it("forwards IPC connection state changes to the lifecycle owner", () => {
    const seenConnectionStates: Array<{ connected: boolean; reason?: string }> = [];
    const ipcClient = new FakeIpcClient();
    const connectionLifecycleOwner: CodexAgentAdapterIpcConnectionLifecycleOwner = {
      handleIpcConnectionState: (state) => {
        seenConnectionStates.push(state);
      },
    };
    const threadStreamStateOwner: CodexAgentAdapterIpcThreadStreamStateOwner = {
      describeFrame: () => ({
        method: THREAD_STREAM_STATE_CHANGED_METHOD,
        threadId: DEFAULT_THREAD_IDENTIFIER,
      }),
      ingestInboundFrame: () => {},
    };

    wireCodexAgentAdapterIpcIngress({
      ipcClient,
      connectionLifecycleOwner,
      threadStreamStateOwner,
      emitIpcFrame: () => {},
    });

    ipcClient.emitConnectionState({ connected: true });
    ipcClient.emitConnectionState({ connected: false, reason: "disconnected" });

    expect(seenConnectionStates).toEqual([
      { connected: true },
      { connected: false, reason: "disconnected" },
    ]);
  });
});

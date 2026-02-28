import { describe, expect, it } from "vitest";
import {
  FarfieldHttpResponseDecodeInThreadOwner,
  type FarfieldHttpResponseDecodeMessageWorker,
  FarfieldHttpResponseDecodeWorkerOwner,
} from "../Source/Shared/Transport/FarfieldHttpResponseDecodeOwner";
import {
  type FarfieldHttpResponseDecodeWorkerRequest,
  type FarfieldHttpResponseDecodeWorkerResponse,
  parseFarfieldHttpResponseDecodeWorkerRequest,
} from "../Source/Shared/Transport/FarfieldHttpResponseDecodeWorkerContracts";

type TestWorkerMode = "in-order" | "reverse-first-two" | "hold";

const WORKER_EVENT_NAME_MESSAGE = "message";

class TestFarfieldHttpResponseDecodeWorker implements FarfieldHttpResponseDecodeMessageWorker {
  private readonly inThreadDecodeOwner = new FarfieldHttpResponseDecodeInThreadOwner();
  private readonly messageListeners: Array<(event: MessageEvent) => void> = [];
  private readonly errorListeners: Array<(event: Event) => void> = [];
  private readonly mode: TestWorkerMode;
  private readonly pendingRequests: FarfieldHttpResponseDecodeWorkerRequest[] = [];
  private terminated = false;

  public constructor(mode: TestWorkerMode) {
    this.mode = mode;
  }

  public addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  public addEventListener(type: "error", listener: (event: Event) => void): void;
  public addEventListener(
    type: "message" | "error",
    listener: ((event: MessageEvent) => void) | ((event: Event) => void),
  ): void {
    if (type === "message") {
      this.messageListeners.push(listener as (event: MessageEvent) => void);
      return;
    }
    this.errorListeners.push(listener as (event: Event) => void);
  }

  public removeEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  public removeEventListener(type: "error", listener: (event: Event) => void): void;
  public removeEventListener(
    type: "message" | "error",
    listener: ((event: MessageEvent) => void) | ((event: Event) => void),
  ): void {
    if (type === "message") {
      const listenerIndex = this.messageListeners.indexOf(
        listener as (event: MessageEvent) => void,
      );
      if (listenerIndex >= 0) {
        this.messageListeners.splice(listenerIndex, 1);
      }
      return;
    }

    const listenerIndex = this.errorListeners.indexOf(listener as (event: Event) => void);
    if (listenerIndex >= 0) {
      this.errorListeners.splice(listenerIndex, 1);
    }
  }

  public postMessage(message: FarfieldHttpResponseDecodeWorkerRequest): void {
    const parsedRequest = parseFarfieldHttpResponseDecodeWorkerRequest(message);

    if (this.mode === "hold") {
      this.pendingRequests.push(parsedRequest);
      return;
    }

    if (this.mode === "reverse-first-two") {
      this.pendingRequests.push(parsedRequest);
      if (this.pendingRequests.length === 2) {
        const firstRequest = this.pendingRequests[0];
        const secondRequest = this.pendingRequests[1];
        this.pendingRequests.length = 0;
        if (secondRequest && firstRequest) {
          this.dispatchRequest(secondRequest);
          this.dispatchRequest(firstRequest);
        }
      }
      return;
    }

    this.dispatchRequest(parsedRequest);
  }

  public terminate(): void {
    this.terminated = true;
  }

  public readTerminatedState(): boolean {
    return this.terminated;
  }

  private dispatchRequest(request: FarfieldHttpResponseDecodeWorkerRequest): void {
    void this.inThreadDecodeOwner.readDecodedPayload(request.parseText).then((result) => {
      if (result.kind === "success") {
        this.emitMessage({
          requestId: request.requestId,
          kind: "success",
          data: result.data,
          envelopeOk: result.envelopeOk,
        });
        return;
      }

      this.emitMessage({
        requestId: request.requestId,
        kind: "failure",
        reasonKind: result.reasonKind,
        reason: result.reason,
      });
    });
  }

  private emitMessage(response: FarfieldHttpResponseDecodeWorkerResponse): void {
    const messageEvent = new MessageEvent(WORKER_EVENT_NAME_MESSAGE, {
      data: response,
    });
    for (const messageListener of this.messageListeners) {
      messageListener(messageEvent);
    }
  }
}

describe("FarfieldHttpResponseDecodeWorkerOwner", () => {
  it("matches in-thread decode outputs during replay", async () => {
    const worker = new TestFarfieldHttpResponseDecodeWorker("in-order");
    const owner = new FarfieldHttpResponseDecodeWorkerOwner({
      createWorker: () => worker,
    });
    const inThreadOwner = new FarfieldHttpResponseDecodeInThreadOwner();
    const replayInputs = [
      JSON.stringify({
        ok: true,
        data: "payload",
      }),
      JSON.stringify({
        ok: false,
        error: "failed",
      }),
      `{"ok":true,"data":"${"x".repeat(2_000)}`,
      JSON.stringify({
        data: "missing-envelope-flag",
      }),
    ];

    for (const replayInput of replayInputs) {
      const workerResult = await owner.readDecodedPayload(replayInput);
      const inThreadResult = await inThreadOwner.readDecodedPayload(replayInput);
      expect(workerResult).toEqual(inThreadResult);
    }

    owner.dispose();
    expect(worker.readTerminatedState()).toBe(true);
  });

  it("resolves request promises by request identifier when responses arrive out of order", async () => {
    const worker = new TestFarfieldHttpResponseDecodeWorker("reverse-first-two");
    const owner = new FarfieldHttpResponseDecodeWorkerOwner({
      createWorker: () => worker,
    });
    const firstPayloadText = JSON.stringify({
      ok: true,
      data: "first-payload",
    });
    const secondPayloadText = JSON.stringify({
      ok: true,
      data: "second-payload",
    });

    const firstResultPromise = owner.readDecodedPayload(firstPayloadText);
    const secondResultPromise = owner.readDecodedPayload(secondPayloadText);
    const [firstResult, secondResult] = await Promise.all([
      firstResultPromise,
      secondResultPromise,
    ]);

    expect(firstResult).toEqual({
      kind: "success",
      data: {
        ok: true,
        data: "first-payload",
      },
      envelopeOk: true,
    });
    expect(secondResult).toEqual({
      kind: "success",
      data: {
        ok: true,
        data: "second-payload",
      },
      envelopeOk: true,
    });

    owner.dispose();
  });

  it("rejects pending decode requests when disposed", async () => {
    const worker = new TestFarfieldHttpResponseDecodeWorker("hold");
    const owner = new FarfieldHttpResponseDecodeWorkerOwner({
      createWorker: () => worker,
    });

    const pendingDecodePromise = owner.readDecodedPayload(
      JSON.stringify({
        ok: true,
        data: "held-payload",
      }),
    );
    owner.dispose();

    await expect(pendingDecodePromise).rejects.toThrow(
      "FarfieldHttpResponseDecodeWorkerOwner has been disposed.",
    );
  });
});

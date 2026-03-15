import { describe, expect, it } from "vitest";
import {
  ConversationItemFlattener,
  type ConversationTurn,
} from "../Source/Features/Chat/DomainModel/ConversationItemFlattener";
import {
  type ConversationItemFlatteningWorkerRequest,
  type ConversationItemFlatteningWorkerResponse,
  parseConversationItemFlatteningWorkerRequest,
} from "../Source/Features/Chat/StateManagement/ConversationItemFlatteningWorkerContracts";
import {
  type ConversationItemFlatteningMessageWorker,
  ConversationItemFlatteningWorkerOwner,
} from "../Source/Features/Chat/StateManagement/ConversationItemFlatteningWorkerOwner";

type TestWorkerMode = "in-order" | "reverse-first-two" | "hold";

const WORKER_EVENT_NAME_MESSAGE = "message";

function createAgentMessageTurn(input: {
  turnId: string;
  itemId: string;
  text: string;
  status?: string;
}): ConversationTurn {
  return {
    id: input.turnId,
    status: input.status ?? "completed",
    items: [
      {
        id: input.itemId,
        type: "agentMessage",
        text: input.text,
      },
    ],
  };
}

function createUserMessageTurn(input: {
  turnId: string;
  itemId: string;
  text: string;
  status?: string;
}): ConversationTurn {
  return {
    id: input.turnId,
    status: input.status ?? "completed",
    items: [
      {
        id: input.itemId,
        type: "userMessage",
        content: [
          {
            type: "text",
            text: input.text,
          },
        ],
      },
    ],
  };
}

class TestConversationItemFlatteningWorker implements ConversationItemFlatteningMessageWorker {
  private readonly conversationItemFlattener = new ConversationItemFlattener();
  private readonly messageListeners: Array<(event: MessageEvent) => void> = [];
  private readonly errorListeners: Array<(event: Event) => void> = [];
  private readonly mode: TestWorkerMode;
  private readonly pendingRequests: ConversationItemFlatteningWorkerRequest[] = [];
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

  public postMessage(message: ConversationItemFlatteningWorkerRequest): void {
    const parsedRequest = parseConversationItemFlatteningWorkerRequest(message);

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

  private dispatchRequest(request: ConversationItemFlatteningWorkerRequest): void {
    const flattenedItems = this.conversationItemFlattener.flattenConversationItems(
      request.input.turns,
      request.input.isGenerating,
    );
    this.emitMessage({
      requestId: request.requestId,
      kind: "success",
      flattenedItems,
    });
  }

  private emitMessage(response: ConversationItemFlatteningWorkerResponse): void {
    const messageEvent = new MessageEvent(WORKER_EVENT_NAME_MESSAGE, {
      data: response,
    });
    for (const messageListener of this.messageListeners) {
      messageListener(messageEvent);
    }
  }
}

describe("ConversationItemFlatteningWorkerOwner", () => {
  it("matches canonical flattened outputs during replay", async () => {
    const worker = new TestConversationItemFlatteningWorker("in-order");
    const owner = new ConversationItemFlatteningWorkerOwner({
      createWorker: () => worker,
    });
    const canonicalFlattener = new ConversationItemFlattener();
    const replayInputs = [
      {
        turns: [createAgentMessageTurn({ turnId: "turn-1", itemId: "item-1", text: "hello" })],
        isGenerating: false,
      },
      {
        turns: [
          createUserMessageTurn({ turnId: "turn-2", itemId: "item-2", text: "prompt" }),
          createAgentMessageTurn({
            turnId: "turn-3",
            itemId: "item-3",
            text: "in-progress response",
            status: "in-progress",
          }),
        ],
        isGenerating: true,
      },
    ];

    for (const replayInput of replayInputs) {
      const workerFlattenedItems = await owner.readFlattenedConversationItems(replayInput);
      const canonicalFlattenedItems = canonicalFlattener.flattenConversationItems(
        replayInput.turns,
        replayInput.isGenerating,
      );
      expect(workerFlattenedItems).toEqual(canonicalFlattenedItems);
    }

    owner.dispose();
    expect(worker.readTerminatedState()).toBe(true);
  });

  it("resolves request promises by request identifier when responses arrive out of order", async () => {
    const worker = new TestConversationItemFlatteningWorker("reverse-first-two");
    const owner = new ConversationItemFlatteningWorkerOwner({
      createWorker: () => worker,
    });
    const canonicalFlattener = new ConversationItemFlattener();
    const firstInput = {
      turns: [createAgentMessageTurn({ turnId: "turn-4", itemId: "item-4", text: "first" })],
      isGenerating: false,
    };
    const secondInput = {
      turns: [createAgentMessageTurn({ turnId: "turn-5", itemId: "item-5", text: "second" })],
      isGenerating: false,
    };

    const firstFlattenedItemsPromise = owner.readFlattenedConversationItems(firstInput);
    const secondFlattenedItemsPromise = owner.readFlattenedConversationItems(secondInput);
    const [firstFlattenedItems, secondFlattenedItems] = await Promise.all([
      firstFlattenedItemsPromise,
      secondFlattenedItemsPromise,
    ]);

    expect(firstFlattenedItems).toEqual(
      canonicalFlattener.flattenConversationItems(firstInput.turns, firstInput.isGenerating),
    );
    expect(secondFlattenedItems).toEqual(
      canonicalFlattener.flattenConversationItems(secondInput.turns, secondInput.isGenerating),
    );

    owner.dispose();
  });

  it("rejects pending flattening requests when disposed", async () => {
    const worker = new TestConversationItemFlatteningWorker("hold");
    const owner = new ConversationItemFlatteningWorkerOwner({
      createWorker: () => worker,
    });

    const pendingFlattenedItemsPromise = owner.readFlattenedConversationItems({
      turns: [createAgentMessageTurn({ turnId: "turn-6", itemId: "item-6", text: "held" })],
      isGenerating: false,
    });
    owner.dispose();

    await expect(pendingFlattenedItemsPromise).rejects.toThrow(
      "ConversationItemFlatteningWorkerOwner has been disposed.",
    );
  });
});

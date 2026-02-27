import { parseThreadConversationState } from "@farfield/protocol";
import { describe, expect, it } from "vitest";
import { CompletionDetector } from "../Source/Modules/Threads/CompletionDetector.js";

describe("CompletionDetector", () => {
  it("detects a new completed turn with an agent message", () => {
    const detector = new CompletionDetector(new Map());
    const state = parseThreadConversationState({
      id: "thread_1",
      turns: [
        {
          turnId: "turn_1",
          status: "completed",
          items: [
            {
              id: "item_agent_1",
              type: "agentMessage",
              text: "done",
            },
          ],
        },
      ],
      requests: [],
    });

    const candidate = detector.detect("thread_1", state);
    expect(candidate?.threadId).toBe("thread_1");
    expect(candidate?.turnId).toBe("turn_1");
    expect(candidate?.agentMessageId).toBe("item_agent_1");
  });

  it("suppresses duplicate completion markers after commit", () => {
    const detector = new CompletionDetector(new Map());
    const state = parseThreadConversationState({
      id: "thread_1",
      turns: [
        {
          turnId: "turn_1",
          status: "completed",
          items: [
            {
              id: "item_agent_1",
              type: "agentMessage",
              text: "done",
            },
          ],
        },
      ],
      requests: [],
    });

    const first = detector.detect("thread_1", state);
    expect(first).not.toBeNull();
    if (!first) {
      throw new Error("Expected completion candidate");
    }
    detector.commit("thread_1", first.marker);
    const second = detector.detect("thread_1", state);
    expect(second).toBeNull();
  });

  it("suppresses duplicate completion markers from initial watermarks", () => {
    const marker = "thread_1:turn_1:item_agent_1";
    const detector = new CompletionDetector(new Map([["thread_1", marker]]));
    const state = parseThreadConversationState({
      id: "thread_1",
      turns: [
        {
          turnId: "turn_1",
          status: "completed",
          items: [
            {
              id: "item_agent_1",
              type: "agentMessage",
              text: "done",
            },
          ],
        },
      ],
      requests: [],
    });

    const candidate = detector.detect("thread_1", state);
    expect(candidate).toBeNull();
  });

  it("does not emit candidate for non-completed turn", () => {
    const detector = new CompletionDetector(new Map());
    const state = parseThreadConversationState({
      id: "thread_1",
      turns: [
        {
          turnId: "turn_1",
          status: "in_progress",
          items: [
            {
              id: "item_agent_1",
              type: "agentMessage",
              text: "working",
            },
          ],
        },
      ],
      requests: [],
    });

    const candidate = detector.detect("thread_1", state);
    expect(candidate).toBeNull();
  });

  it("detects the most recent completed turn even when the latest turn is still running", () => {
    const detector = new CompletionDetector(new Map());
    const state = parseThreadConversationState({
      id: "thread_1",
      turns: [
        {
          turnId: "turn_1",
          status: "completed",
          items: [
            {
              id: "item_agent_1",
              type: "agentMessage",
              text: "done",
            },
          ],
        },
        {
          turnId: "turn_2",
          status: "in_progress",
          items: [
            {
              id: "item_agent_2",
              type: "agentMessage",
              text: "working",
            },
          ],
        },
      ],
      requests: [],
    });

    const candidate = detector.detect("thread_1", state);
    expect(candidate?.turnId).toBe("turn_1");
    expect(candidate?.agentMessageId).toBe("item_agent_1");
  });

  it("does not emit older completed turns when the newest completed turn is already committed", () => {
    const detector = new CompletionDetector(
      new Map([["thread_1", "thread_1:turn_2:item_agent_2"]]),
    );
    const state = parseThreadConversationState({
      id: "thread_1",
      turns: [
        {
          turnId: "turn_1",
          status: "completed",
          items: [
            {
              id: "item_agent_1",
              type: "agentMessage",
              text: "older",
            },
          ],
        },
        {
          turnId: "turn_2",
          status: "completed",
          items: [
            {
              id: "item_agent_2",
              type: "agentMessage",
              text: "newer",
            },
          ],
        },
        {
          turnId: "turn_3",
          status: "in_progress",
          items: [],
        },
      ],
      requests: [],
    });

    const candidate = detector.detect("thread_1", state);
    expect(candidate).toBeNull();
  });

  it("accepts completed status values regardless of case", () => {
    const detector = new CompletionDetector(new Map());
    const state = parseThreadConversationState({
      id: "thread_1",
      turns: [
        {
          turnId: "turn_1",
          status: "COMPLETED",
          items: [
            {
              id: "item_agent_1",
              type: "agentMessage",
              text: "done",
            },
          ],
        },
      ],
      requests: [],
    });

    const candidate = detector.detect("thread_1", state);
    expect(candidate).not.toBeNull();
    expect(candidate?.turnId).toBe("turn_1");
  });

  it("uses legacy turn identifier when turnId is absent", () => {
    const detector = new CompletionDetector(new Map());
    const state = parseThreadConversationState({
      id: "thread_1",
      turns: [
        {
          id: "turn_legacy_id",
          turnId: null,
          status: "completed",
          items: [
            {
              id: "item_agent_1",
              type: "agentMessage",
              text: "done",
            },
          ],
        },
      ],
      requests: [],
    });

    const candidate = detector.detect("thread_1", state);
    expect(candidate).not.toBeNull();
    expect(candidate?.turnId).toBe("turn_legacy_id");
  });

  it("uses the last agent message item from the completed turn", () => {
    const detector = new CompletionDetector(new Map());
    const state = parseThreadConversationState({
      id: "thread_1",
      turns: [
        {
          turnId: "turn_1",
          status: "completed",
          items: [
            {
              id: "item_agent_1",
              type: "agentMessage",
              text: "older",
            },
            {
              id: "item_error_1",
              type: "error",
              message: "transient",
            },
            {
              id: "item_agent_2",
              type: "agentMessage",
              text: "newer",
            },
          ],
        },
      ],
      requests: [],
    });

    const candidate = detector.detect("thread_1", state);
    expect(candidate).not.toBeNull();
    expect(candidate?.agentMessageId).toBe("item_agent_2");
    expect(candidate?.agentText).toBe("newer");
  });

  it("tracks watermark state through commit and read APIs", () => {
    const detector = new CompletionDetector(new Map());
    expect(detector.getWatermark("thread_1")).toBeNull();

    detector.commit("thread_1", "thread_1:turn_1:item_agent_1");
    expect(detector.getWatermark("thread_1")).toBe("thread_1:turn_1:item_agent_1");
  });
});

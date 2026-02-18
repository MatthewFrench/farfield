import { describe, expect, it } from "vitest";
import { parseThreadConversationState } from "@farfield/protocol";
import { CompletionDetector } from "../src/completion-detector.js";

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
              text: "done"
            }
          ]
        }
      ],
      requests: []
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
              text: "done"
            }
          ]
        }
      ],
      requests: []
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
              text: "working"
            }
          ]
        }
      ],
      requests: []
    });

    const candidate = detector.detect("thread_1", state);
    expect(candidate).toBeNull();
  });
});

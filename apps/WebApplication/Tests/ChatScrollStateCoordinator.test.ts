import { describe, expect, it } from "vitest";
import { ChatScrollStateCoordinator } from "../Source/Features/Chat/StateManagement/ChatScrollStateCoordinator";

function createScrollElement(input: {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
}): {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
} {
  return {
    scrollHeight: input.scrollHeight,
    scrollTop: input.scrollTop,
    clientHeight: input.clientHeight
  };
}

describe("ChatScrollStateCoordinator", () => {
  it("reads distance and bottom-state using threshold", () => {
    const coordinator = new ChatScrollStateCoordinator(48);
    const nearBottomElement = createScrollElement({
      scrollHeight: 1000,
      scrollTop: 455,
      clientHeight: 500
    });
    const farFromBottomElement = createScrollElement({
      scrollHeight: 1000,
      scrollTop: 400,
      clientHeight: 500
    });

    expect(coordinator.readDistanceFromBottom(nearBottomElement)).toBe(45);
    expect(coordinator.readIsAtBottom(nearBottomElement)).toBe(true);
    expect(coordinator.readDistanceFromBottom(farFromBottomElement)).toBe(100);
    expect(coordinator.readIsAtBottom(farFromBottomElement)).toBe(false);
  });

  it("reports synchronization changes when bottom-state flips", () => {
    const coordinator = new ChatScrollStateCoordinator(48);
    const notBottomElement = createScrollElement({
      scrollHeight: 1000,
      scrollTop: 300,
      clientHeight: 500
    });
    const bottomElement = createScrollElement({
      scrollHeight: 1000,
      scrollTop: 460,
      clientHeight: 500
    });

    const firstResult = coordinator.synchronizeBottomState({
      scrollElement: notBottomElement,
      previousIsAtBottom: true
    });
    const secondResult = coordinator.synchronizeBottomState({
      scrollElement: bottomElement,
      previousIsAtBottom: false
    });

    expect(firstResult).toEqual({
      nextIsAtBottom: false,
      changed: true
    });
    expect(secondResult).toEqual({
      nextIsAtBottom: true,
      changed: true
    });
  });

  it("pins scroll to bottom", () => {
    const coordinator = new ChatScrollStateCoordinator(48);
    const scrollElement = createScrollElement({
      scrollHeight: 1250,
      scrollTop: 200,
      clientHeight: 500
    });

    coordinator.pinToBottom(scrollElement);

    expect(scrollElement.scrollTop).toBe(1250);
  });

  it("clamps overscroll distance to zero", () => {
    const coordinator = new ChatScrollStateCoordinator(48);
    const overscrolledElement = createScrollElement({
      scrollHeight: 1000,
      scrollTop: 700,
      clientHeight: 400
    });

    expect(coordinator.readDistanceFromBottom(overscrolledElement)).toBe(0);
    expect(coordinator.readIsAtBottom(overscrolledElement)).toBe(true);
  });
});

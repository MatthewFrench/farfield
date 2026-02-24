import { describe, expect, it } from "vitest";
import { ApplicationRouteStateMapper } from "../Source/Application/DomainModel/ApplicationRouteStateMapper";

describe("ApplicationRouteStateMapper", () => {
  it("parses chat root and debug root routes", () => {
    const mapper = new ApplicationRouteStateMapper();

    expect(mapper.parseFromPathname("/")).toEqual({ threadId: null, tab: "chat" });
    expect(mapper.parseFromPathname("/debug")).toEqual({ threadId: null, tab: "debug" });
  });

  it("parses thread routes with encoded identifiers", () => {
    const mapper = new ApplicationRouteStateMapper();
    const parsed = mapper.parseFromPathname("/threads/thread%2F123/debug");

    expect(parsed).toEqual({
      threadId: "thread/123",
      tab: "debug"
    });
  });

  it("builds routes for thread and non-thread state", () => {
    const mapper = new ApplicationRouteStateMapper();

    expect(mapper.buildPath({ threadId: null, tab: "chat" })).toBe("/");
    expect(mapper.buildPath({ threadId: null, tab: "debug" })).toBe("/debug");
    expect(mapper.buildPath({ threadId: "thread/123", tab: "chat" })).toBe("/threads/thread%2F123");
    expect(mapper.buildPath({ threadId: "thread/123", tab: "debug" })).toBe(
      "/threads/thread%2F123/debug"
    );
  });
});

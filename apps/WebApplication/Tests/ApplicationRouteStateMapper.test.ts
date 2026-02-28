import { describe, expect, it } from "vitest";
import { ApplicationRouteStateMapper } from "../Source/Application/DomainModel/ApplicationRouteStateMapper";

describe("ApplicationRouteStateMapper", () => {
  it("parses chat root, legacy debug root, and settings routes", () => {
    const mapper = new ApplicationRouteStateMapper();

    expect(mapper.parseFromLocation("/", "")).toEqual({
      threadId: null,
      tab: "chat",
      settingsWorkspaceSection: "notifications",
    });
    expect(mapper.parseFromLocation("/debug", "")).toEqual({
      threadId: null,
      tab: "debug",
      settingsWorkspaceSection: "debug",
    });
    expect(mapper.parseFromLocation("/settings", "")).toEqual({
      threadId: null,
      tab: "debug",
      settingsWorkspaceSection: "notifications",
    });
    expect(mapper.parseFromLocation("/settings", "?tab=debug")).toEqual({
      threadId: null,
      tab: "debug",
      settingsWorkspaceSection: "debug",
    });
    expect(mapper.parseFromLocation("/settings", "?tab=invalid")).toEqual({
      threadId: null,
      tab: "debug",
      settingsWorkspaceSection: "notifications",
    });
  });

  it("parses thread settings routes with encoded identifiers", () => {
    const mapper = new ApplicationRouteStateMapper();
    const parsed = mapper.parseFromLocation("/threads/thread%2F123/settings", "?tab=debug");
    const legacyParsed = mapper.parseFromLocation("/threads/thread%2F123/debug", "");

    expect(parsed).toEqual({
      threadId: "thread/123",
      tab: "debug",
      settingsWorkspaceSection: "debug",
    });
    expect(legacyParsed).toEqual({
      threadId: "thread/123",
      tab: "debug",
      settingsWorkspaceSection: "debug",
    });
  });

  it("returns neutral route state for malformed encoded thread identifiers", () => {
    const mapper = new ApplicationRouteStateMapper();
    const malformedParsed = mapper.parseFromLocation("/threads/%E0%A4%A", "");
    const whitespaceParsed = mapper.parseFromLocation("/threads/%20/settings", "?tab=debug");

    expect(malformedParsed).toEqual({
      threadId: null,
      tab: "chat",
      settingsWorkspaceSection: "notifications",
    });
    expect(whitespaceParsed).toEqual({
      threadId: null,
      tab: "chat",
      settingsWorkspaceSection: "notifications",
    });
  });

  it("returns neutral route state for non-thread and thread-root paths", () => {
    const mapper = new ApplicationRouteStateMapper();

    expect(mapper.parseFromPathname("/threads")).toEqual({
      threadId: null,
      tab: "chat",
      settingsWorkspaceSection: "notifications",
    });
  });

  it("builds routes for thread chat and settings states", () => {
    const mapper = new ApplicationRouteStateMapper();

    expect(
      mapper.buildPath({
        threadId: null,
        tab: "chat",
        settingsWorkspaceSection: "notifications",
      }),
    ).toBe("/");
    expect(
      mapper.buildPath({
        threadId: null,
        tab: "debug",
        settingsWorkspaceSection: "notifications",
      }),
    ).toBe("/settings?tab=notifications");
    expect(
      mapper.buildPath({
        threadId: null,
        tab: "debug",
        settingsWorkspaceSection: "debug",
      }),
    ).toBe("/settings?tab=debug");
    expect(
      mapper.buildPath({
        threadId: "   ",
        tab: "chat",
        settingsWorkspaceSection: "notifications",
      }),
    ).toBe("/");
    expect(
      mapper.buildPath({
        threadId: "thread/123",
        tab: "chat",
        settingsWorkspaceSection: "notifications",
      }),
    ).toBe("/threads/thread%2F123");
    expect(
      mapper.buildPath({
        threadId: "thread/123",
        tab: "debug",
        settingsWorkspaceSection: "notifications",
      }),
    ).toBe("/threads/thread%2F123/settings?tab=notifications");
    expect(
      mapper.buildPath({
        threadId: "thread/123",
        tab: "debug",
        settingsWorkspaceSection: "debug",
      }),
    ).toBe("/threads/thread%2F123/settings?tab=debug");
  });

  it("parses pathname-only settings routes with notifications as the default section", () => {
    const mapper = new ApplicationRouteStateMapper();

    expect(mapper.parseFromPathname("/settings")).toEqual({
      threadId: null,
      tab: "debug",
      settingsWorkspaceSection: "notifications",
    });
    expect(mapper.parseFromPathname("/threads/thread-123/settings")).toEqual({
      threadId: "thread-123",
      tab: "debug",
      settingsWorkspaceSection: "notifications",
    });
  });
});

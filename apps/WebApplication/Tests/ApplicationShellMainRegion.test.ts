import { describe, expect, it } from "vitest";
import {
  type ApplicationShellMainRegionMemoSnapshot,
  areApplicationShellMainRegionMemoSnapshotsEqual,
} from "@/Application/UserInterface/ApplicationShellMainRegion";

function createMemoSnapshot(input?: {
  activeTab?: "chat" | "debug";
  applicationHeaderBarProperties?: object;
  debugStatusBannersProperties?: object;
  chatWorkspacePaneProperties?: object;
  settingsWorkspacePaneProperties?: object;
  showApiSessionBootstrapOverlay?: boolean;
  apiSessionBootstrapOverlayProperties?: object;
}): ApplicationShellMainRegionMemoSnapshot {
  return {
    isMobileLayout: true,
    desktopSidebarOpen: true,
    activeTab: input?.activeTab ?? "chat",
    applicationHeaderBarProperties: input?.applicationHeaderBarProperties ?? {},
    debugStatusBannersProperties: input?.debugStatusBannersProperties ?? {},
    chatWorkspacePaneProperties: input?.chatWorkspacePaneProperties ?? {},
    settingsWorkspacePaneProperties: input?.settingsWorkspacePaneProperties ?? {},
    showApiSessionBootstrapOverlay: input?.showApiSessionBootstrapOverlay ?? false,
    apiSessionBootstrapOverlayProperties: input?.apiSessionBootstrapOverlayProperties ?? {},
  };
}

describe("ApplicationShellMainRegion", () => {
  it("ignores settings-pane prop churn while chat tab is active", () => {
    const previousSnapshot = createMemoSnapshot({
      activeTab: "chat",
      settingsWorkspacePaneProperties: { renderId: 1 },
    });
    const nextSnapshot = createMemoSnapshot({
      activeTab: "chat",
      applicationHeaderBarProperties: previousSnapshot.applicationHeaderBarProperties,
      debugStatusBannersProperties: previousSnapshot.debugStatusBannersProperties,
      chatWorkspacePaneProperties: previousSnapshot.chatWorkspacePaneProperties,
      settingsWorkspacePaneProperties: { renderId: 2 },
    });

    expect(areApplicationShellMainRegionMemoSnapshotsEqual(previousSnapshot, nextSnapshot)).toBe(
      true,
    );
  });

  it("reacts to chat-pane prop changes while chat tab is active", () => {
    const previousSnapshot = createMemoSnapshot({
      activeTab: "chat",
      chatWorkspacePaneProperties: { renderId: 1 },
    });
    const nextSnapshot = createMemoSnapshot({
      activeTab: "chat",
      applicationHeaderBarProperties: previousSnapshot.applicationHeaderBarProperties,
      debugStatusBannersProperties: previousSnapshot.debugStatusBannersProperties,
      settingsWorkspacePaneProperties: previousSnapshot.settingsWorkspacePaneProperties,
      chatWorkspacePaneProperties: { renderId: 2 },
    });

    expect(areApplicationShellMainRegionMemoSnapshotsEqual(previousSnapshot, nextSnapshot)).toBe(
      false,
    );
  });

  it("ignores overlay prop churn while the overlay is hidden", () => {
    const previousSnapshot = createMemoSnapshot({
      showApiSessionBootstrapOverlay: false,
      apiSessionBootstrapOverlayProperties: { renderId: 1 },
    });
    const nextSnapshot = createMemoSnapshot({
      applicationHeaderBarProperties: previousSnapshot.applicationHeaderBarProperties,
      debugStatusBannersProperties: previousSnapshot.debugStatusBannersProperties,
      chatWorkspacePaneProperties: previousSnapshot.chatWorkspacePaneProperties,
      settingsWorkspacePaneProperties: previousSnapshot.settingsWorkspacePaneProperties,
      showApiSessionBootstrapOverlay: false,
      apiSessionBootstrapOverlayProperties: { renderId: 2 },
    });

    expect(areApplicationShellMainRegionMemoSnapshotsEqual(previousSnapshot, nextSnapshot)).toBe(
      true,
    );
  });
});

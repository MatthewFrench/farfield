import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApplicationHeaderBar } from "@/Application/UserInterface/ApplicationHeaderBar";
import { TooltipProvider } from "@/Components/UserInterface/Tooltip";

interface RenderApplicationHeaderBarInput {
  activeTab?: "chat" | "debug";
  desktopSidebarOpen?: boolean;
  isBusy?: boolean;
  onRefresh?: () => void;
  onToggleDebugTab?: () => void;
  onEnablePushNotifications?: () => void;
  onOpenMobileSidebar?: () => void;
  onOpenDesktopSidebar?: () => void;
}

const DEFAULT_PUSH_CLIENT_STATE = {
  supported: true,
  serviceWorkerRegistered: true,
  permission: "default" as const,
  subscribed: false
};

function renderApplicationHeaderBar(input?: RenderApplicationHeaderBarInput): void {
  cleanup();
  render(
    <TooltipProvider>
      <ApplicationHeaderBar
        activeTab={input?.activeTab ?? "chat"}
        desktopSidebarOpen={input?.desktopSidebarOpen ?? true}
        selectedThreadLabel="Thread one"
        hasSelectedThread={true}
        activeThreadAgentId="codex"
        activeAgentLabel="Codex"
        isGenerating={false}
        pushClientState={DEFAULT_PUSH_CLIENT_STATE}
        isEnablingPushNotifications={false}
        isBusy={input?.isBusy ?? false}
        theme="light"
        onOpenMobileSidebar={input?.onOpenMobileSidebar ?? (() => {})}
        onOpenDesktopSidebar={input?.onOpenDesktopSidebar ?? (() => {})}
        onEnablePushNotifications={input?.onEnablePushNotifications ?? (() => {})}
        onRefresh={input?.onRefresh ?? (() => {})}
        onToggleDebugTab={input?.onToggleDebugTab ?? (() => {})}
        onToggleTheme={() => {}}
        renderAgentFavicon={() => null}
      />
    </TooltipProvider>
  );
}

describe("ApplicationHeaderBar", () => {
  it("invokes refresh and debug toggle actions", () => {
    const onRefresh = vi.fn();
    const onToggleDebugTab = vi.fn();

    renderApplicationHeaderBar({
      onRefresh,
      onToggleDebugTab
    });

    fireEvent.click(screen.getByTestId("refresh-button"));
    fireEvent.click(screen.getByTestId("tab-debug"));

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onToggleDebugTab).toHaveBeenCalledTimes(1);
  });

  it("invokes push enable action", () => {
    const onEnablePushNotifications = vi.fn();

    renderApplicationHeaderBar({
      onEnablePushNotifications
    });

    fireEvent.click(screen.getByTestId("enable-notifications-button"));
    expect(onEnablePushNotifications).toHaveBeenCalledTimes(1);
  });

  it("invokes mobile sidebar open action", () => {
    const onOpenMobileSidebar = vi.fn();
    const onToggleDebugTab = vi.fn();

    renderApplicationHeaderBar({
      onOpenMobileSidebar,
      onToggleDebugTab
    });

    fireEvent.click(screen.getByRole("button", { name: "Threads" }));
    expect(onOpenMobileSidebar).toHaveBeenCalledTimes(1);
    expect(onToggleDebugTab).not.toHaveBeenCalled();
  });

  it("closes debug tab when opening mobile sidebar from debug view", () => {
    const onOpenMobileSidebar = vi.fn();
    const onToggleDebugTab = vi.fn();

    renderApplicationHeaderBar({
      activeTab: "debug",
      onOpenMobileSidebar,
      onToggleDebugTab
    });

    fireEvent.click(screen.getByRole("button", { name: "Threads" }));

    expect(onOpenMobileSidebar).toHaveBeenCalledTimes(1);
    expect(onToggleDebugTab).toHaveBeenCalledTimes(1);
  });

  it("closes debug tab when opening desktop sidebar from debug view", () => {
    const onOpenDesktopSidebar = vi.fn();
    const onToggleDebugTab = vi.fn();

    renderApplicationHeaderBar({
      activeTab: "debug",
      desktopSidebarOpen: false,
      onOpenDesktopSidebar,
      onToggleDebugTab
    });

    fireEvent.click(screen.getByRole("button", { name: "Show sidebar" }));

    expect(onOpenDesktopSidebar).toHaveBeenCalledTimes(1);
    expect(onToggleDebugTab).toHaveBeenCalledTimes(1);
  });

  it("does not invoke refresh action while busy", () => {
    const onRefresh = vi.fn();

    renderApplicationHeaderBar({
      isBusy: true,
      onRefresh
    });

    fireEvent.click(screen.getByTestId("refresh-button"));

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("opens desktop sidebar without toggling debug tab from chat view", () => {
    const onOpenDesktopSidebar = vi.fn();
    const onToggleDebugTab = vi.fn();

    renderApplicationHeaderBar({
      activeTab: "chat",
      desktopSidebarOpen: false,
      onOpenDesktopSidebar,
      onToggleDebugTab
    });

    fireEvent.click(screen.getByRole("button", { name: "Show sidebar" }));

    expect(onOpenDesktopSidebar).toHaveBeenCalledTimes(1);
    expect(onToggleDebugTab).not.toHaveBeenCalled();
  });
});

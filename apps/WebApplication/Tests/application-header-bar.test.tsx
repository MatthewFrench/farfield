import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApplicationHeaderBar } from "@/Application/UserInterface/ApplicationHeaderBar";
import { TooltipProvider } from "@/Components/UserInterface/Tooltip";

function renderApplicationHeaderBar(input?: {
  onRefresh?: () => void;
  onToggleDebugTab?: () => void;
  onEnablePushNotifications?: () => void;
  onOpenMobileSidebar?: () => void;
}): void {
  cleanup();
  render(
    <TooltipProvider>
      <ApplicationHeaderBar
        activeTab="chat"
        desktopSidebarOpen={true}
        selectedThreadLabel="Thread one"
        hasSelectedThread={true}
        activeThreadAgentId="codex"
        activeAgentLabel="Codex"
        isGenerating={false}
        pushClientState={{
          supported: true,
          serviceWorkerRegistered: true,
          permission: "default",
          subscribed: false
        }}
        isEnablingPushNotifications={false}
        isBusy={false}
        theme="light"
        onOpenMobileSidebar={input?.onOpenMobileSidebar ?? (() => {})}
        onOpenDesktopSidebar={() => {}}
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

    renderApplicationHeaderBar({
      onOpenMobileSidebar
    });

    fireEvent.click(screen.getByTestId("sidebar-toggle-open"));
    expect(onOpenMobileSidebar).toHaveBeenCalledTimes(1);
  });
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApplicationHeaderBar } from "@/Application/UserInterface/ApplicationHeaderBar";
import { TooltipProvider } from "@/Components/UserInterface/Tooltip";

interface RenderApplicationHeaderBarInput {
  activeTab?: "chat" | "debug";
  desktopSidebarOpen?: boolean;
  isBusy?: boolean;
  onRefresh?: () => void;
  onToggleSettingsTab?: () => void;
  onOpenMobileSidebar?: () => void;
  onOpenDesktopSidebar?: () => void;
}

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
        isBusy={input?.isBusy ?? false}
        theme="light"
        onOpenMobileSidebar={input?.onOpenMobileSidebar ?? (() => {})}
        onOpenDesktopSidebar={input?.onOpenDesktopSidebar ?? (() => {})}
        onRefresh={input?.onRefresh ?? (() => {})}
        onToggleSettingsTab={input?.onToggleSettingsTab ?? (() => {})}
        onToggleTheme={() => {}}
        renderAgentFavicon={() => null}
      />
    </TooltipProvider>,
  );
}

describe("ApplicationHeaderBar", () => {
  it("invokes refresh and settings toggle actions", () => {
    const onRefresh = vi.fn();
    const onToggleSettingsTab = vi.fn();

    renderApplicationHeaderBar({
      onRefresh,
      onToggleSettingsTab,
    });

    fireEvent.click(screen.getByTestId("refresh-button"));
    fireEvent.click(screen.getByTestId("tab-settings"));

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onToggleSettingsTab).toHaveBeenCalledTimes(1);
  });

  it("invokes mobile sidebar open action", () => {
    const onOpenMobileSidebar = vi.fn();
    const onToggleSettingsTab = vi.fn();

    renderApplicationHeaderBar({
      onOpenMobileSidebar,
      onToggleSettingsTab,
    });

    fireEvent.click(screen.getByRole("button", { name: "Threads" }));
    expect(onOpenMobileSidebar).toHaveBeenCalledTimes(1);
    expect(onToggleSettingsTab).not.toHaveBeenCalled();
  });

  it("closes settings tab when opening mobile sidebar from settings view", () => {
    const onOpenMobileSidebar = vi.fn();
    const onToggleSettingsTab = vi.fn();

    renderApplicationHeaderBar({
      activeTab: "debug",
      onOpenMobileSidebar,
      onToggleSettingsTab,
    });

    fireEvent.click(screen.getByRole("button", { name: "Threads" }));

    expect(onOpenMobileSidebar).toHaveBeenCalledTimes(1);
    expect(onToggleSettingsTab).toHaveBeenCalledTimes(1);
  });

  it("closes settings tab when opening desktop sidebar from settings view", () => {
    const onOpenDesktopSidebar = vi.fn();
    const onToggleSettingsTab = vi.fn();

    renderApplicationHeaderBar({
      activeTab: "debug",
      desktopSidebarOpen: false,
      onOpenDesktopSidebar,
      onToggleSettingsTab,
    });

    fireEvent.click(screen.getByRole("button", { name: "Show sidebar" }));

    expect(onOpenDesktopSidebar).toHaveBeenCalledTimes(1);
    expect(onToggleSettingsTab).toHaveBeenCalledTimes(1);
  });

  it("does not invoke refresh action while busy", () => {
    const onRefresh = vi.fn();

    renderApplicationHeaderBar({
      isBusy: true,
      onRefresh,
    });

    fireEvent.click(screen.getByTestId("refresh-button"));

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("opens desktop sidebar without toggling settings tab from chat view", () => {
    const onOpenDesktopSidebar = vi.fn();
    const onToggleSettingsTab = vi.fn();

    renderApplicationHeaderBar({
      activeTab: "chat",
      desktopSidebarOpen: false,
      onOpenDesktopSidebar,
      onToggleSettingsTab,
    });

    fireEvent.click(screen.getByRole("button", { name: "Show sidebar" }));

    expect(onOpenDesktopSidebar).toHaveBeenCalledTimes(1);
    expect(onToggleSettingsTab).not.toHaveBeenCalled();
  });
});

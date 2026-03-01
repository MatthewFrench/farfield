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
  runtimeWarningSummary?: {
    method:
      | "configWarning"
      | "deprecationNotice"
      | "windows/worldWritableWarning"
      | "thread/realtime/started"
      | "thread/realtime/closed"
      | "error";
    summary: string;
    threadId: string | null;
    isRetrying: boolean;
    sequence: number;
    receivedAtMilliseconds: number;
    refreshedAtMilliseconds: number;
  } | null;
  runtimeModelRerouteSummary?: {
    threadId: string;
    turnId: string;
    fromModel: string;
    toModel: string;
    reason: "highRiskCyberActivity";
    sequence: number;
    receivedAtMilliseconds: number;
    refreshedAtMilliseconds: number;
  } | null;
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
        runtimeWarningSummary={input?.runtimeWarningSummary ?? null}
        runtimeModelRerouteSummary={input?.runtimeModelRerouteSummary ?? null}
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

  it("renders model-reroute runtime banner when a reroute summary is present", () => {
    renderApplicationHeaderBar({
      runtimeModelRerouteSummary: {
        threadId: "thread-1",
        turnId: "turn-1",
        fromModel: "gpt-5",
        toModel: "gpt-5-safe",
        reason: "highRiskCyberActivity",
        sequence: 17,
        receivedAtMilliseconds: 1_700_000_000_000,
        refreshedAtMilliseconds: 1_700_000_000_500,
      },
    });

    expect(screen.getByTestId("header-runtime-model-reroute-banner").textContent).toBe(
      "Model rerouted gpt-5 -> gpt-5-safe",
    );
  });

  it("renders runtime warning banner when warning summary is present", () => {
    renderApplicationHeaderBar({
      runtimeWarningSummary: {
        method: "configWarning",
        summary: "Config file has an unknown key",
        threadId: null,
        isRetrying: false,
        sequence: 18,
        receivedAtMilliseconds: 1_700_000_000_700,
        refreshedAtMilliseconds: 1_700_000_000_800,
      },
    });

    expect(screen.getByTestId("header-runtime-warning-banner").textContent).toBe(
      "Warning: Config file has an unknown key",
    );
  });

  it("renders runtime error banner with retry context", () => {
    renderApplicationHeaderBar({
      runtimeWarningSummary: {
        method: "error",
        summary: "Turn failed to stream",
        threadId: "thread-1",
        isRetrying: true,
        sequence: 20,
        receivedAtMilliseconds: 1_700_000_000_900,
        refreshedAtMilliseconds: 1_700_000_001_000,
      },
    });

    const banner = screen.getByTestId("header-runtime-warning-banner");
    expect(banner.textContent).toBe("Error: Turn failed to stream (retrying)");
    expect(banner.className).toContain("text-red-500");
  });

  it("renders realtime runtime banner with realtime styling", () => {
    renderApplicationHeaderBar({
      runtimeWarningSummary: {
        method: "thread/realtime/closed",
        summary: "Closed (session ended)",
        threadId: "thread-1",
        isRetrying: false,
        sequence: 21,
        receivedAtMilliseconds: 1_700_000_001_100,
        refreshedAtMilliseconds: 1_700_000_001_200,
      },
    });

    const banner = screen.getByTestId("header-runtime-warning-banner");
    expect(banner.textContent).toBe("Realtime: Closed (session ended)");
    expect(banner.className).toContain("text-sky-500");
  });
});

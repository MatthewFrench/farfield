import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApplicationHeaderBar } from "@/Application/UserInterface/ApplicationHeaderBar";
import { TooltipProvider } from "@/Components/UserInterface/Tooltip";

interface RenderApplicationHeaderBarInput {
  activeTab?: "chat" | "debug";
  desktopSidebarOpen?: boolean;
  onToggleSettingsTab?: () => void;
  onOpenMobileSidebar?: () => void;
  onOpenDesktopSidebar?: () => void;
  runtimeWarningSummary?: {
    method:
      | "configWarning"
      | "deprecationNotice"
      | "windows/worldWritableWarning"
      | "mcpServer/oauthLogin/completed"
      | "account/login/completed"
      | "serverRequest/resolved"
      | "thread/archived"
      | "thread/unarchived"
      | "thread/closed"
      | "thread/realtime/started"
      | "thread/realtime/closed"
      | "error";
    severity: "warning" | "error" | "realtime" | "info" | "success";
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
        onOpenMobileSidebar={input?.onOpenMobileSidebar ?? (() => {})}
        onOpenDesktopSidebar={input?.onOpenDesktopSidebar ?? (() => {})}
        onToggleSettingsTab={input?.onToggleSettingsTab ?? (() => {})}
        renderAgentFavicon={() => null}
      />
    </TooltipProvider>,
  );
}

describe("ApplicationHeaderBar", () => {
  it("invokes settings toggle action", () => {
    const onToggleSettingsTab = vi.fn();

    renderApplicationHeaderBar({
      onToggleSettingsTab,
    });

    fireEvent.click(screen.getByTestId("tab-settings"));

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

  it("opens mobile sidebar without toggling settings tab from settings view", () => {
    const onOpenMobileSidebar = vi.fn();
    const onToggleSettingsTab = vi.fn();

    renderApplicationHeaderBar({
      activeTab: "debug",
      onOpenMobileSidebar,
      onToggleSettingsTab,
    });

    fireEvent.click(screen.getByRole("button", { name: "Threads" }));

    expect(onOpenMobileSidebar).toHaveBeenCalledTimes(1);
    expect(onToggleSettingsTab).not.toHaveBeenCalled();
  });

  it("opens desktop sidebar without toggling settings tab from settings view", () => {
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
    expect(onToggleSettingsTab).not.toHaveBeenCalled();
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
        severity: "warning",
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
        severity: "error",
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
        severity: "realtime",
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

  it("renders auth completion banner with success styling", () => {
    renderApplicationHeaderBar({
      runtimeWarningSummary: {
        method: "mcpServer/oauthLogin/completed",
        severity: "success",
        summary: "MCP OAuth connected (github)",
        threadId: null,
        isRetrying: false,
        sequence: 22,
        receivedAtMilliseconds: 1_700_000_001_300,
        refreshedAtMilliseconds: 1_700_000_001_400,
      },
    });

    const banner = screen.getByTestId("header-runtime-warning-banner");
    expect(banner.textContent).toBe("Auth: MCP OAuth connected (github)");
    expect(banner.className).toContain("text-emerald-600");
  });

  it("renders server-request resolved banner with info styling", () => {
    renderApplicationHeaderBar({
      runtimeWarningSummary: {
        method: "serverRequest/resolved",
        severity: "info",
        summary: "Server request #44 resolved",
        threadId: "thread-1",
        isRetrying: false,
        sequence: 23,
        receivedAtMilliseconds: 1_700_000_001_500,
        refreshedAtMilliseconds: 1_700_000_001_600,
      },
    });

    const banner = screen.getByTestId("header-runtime-warning-banner");
    expect(banner.textContent).toBe("Request: Server request #44 resolved");
    expect(banner.className).toContain("text-cyan-600");
  });
});

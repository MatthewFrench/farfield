import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { type ErrorBannerDetails } from "@/Features/Debugging/DomainModel/DebugIssueContracts";
import { DebugStatusBanners } from "@/Features/Debugging/UserInterface/DebugStatusBanners";

const BASE_ERROR_BANNER_DETAILS: ErrorBannerDetails = {
  operation: "thread.read",
  message: "failed to load",
  actionId: "action-1",
  requestId: "request-1",
  errorId: "error-1",
};

function renderDebugStatusBanners(input: {
  activeTab?: "chat" | "debug";
  errorMessage?: string;
  errorBannerDetails?: ErrorBannerDetails;
  onOpenDebugFromErrorBanner?: () => void;
  onDismissErrorBanner?: () => void;
  liveStateReductionError?: {
    eventIndex: number | null;
    patchIndex: number | null;
  } | null;
}): void {
  cleanup();
  render(
    <DebugStatusBanners
      activeTab={input.activeTab ?? "chat"}
      errorMessage={input.errorMessage ?? ""}
      errorBannerDetails={input.errorBannerDetails ?? BASE_ERROR_BANNER_DETAILS}
      onOpenDebugFromErrorBanner={input.onOpenDebugFromErrorBanner ?? (() => {})}
      onDismissErrorBanner={input.onDismissErrorBanner ?? (() => {})}
      liveStateReductionError={input.liveStateReductionError ?? null}
    />,
  );
}

describe("DebugStatusBanners", () => {
  it("renders error banner and invokes error actions", () => {
    const onOpenDebugFromErrorBanner = vi.fn();
    const onDismissErrorBanner = vi.fn();

    renderDebugStatusBanners({
      errorMessage: "thread.read: failed to load",
      onOpenDebugFromErrorBanner,
      onDismissErrorBanner,
    });

    expect(screen.getByTestId("error-banner")).toBeTruthy();
    expect(screen.getByTestId("error-banner-operation").textContent).toContain("thread.read");
    expect(screen.getByTestId("error-banner-message").textContent).toContain("failed to load");

    fireEvent.click(screen.getByTestId("error-banner-open-debug"));
    expect(onOpenDebugFromErrorBanner).toHaveBeenCalledTimes(1);
    expect(onDismissErrorBanner).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("error-banner-dismiss"));

    expect(onOpenDebugFromErrorBanner).toHaveBeenCalledTimes(1);
    expect(onDismissErrorBanner).toHaveBeenCalledTimes(2);
  });

  it("does not render an error banner when no error message is provided", () => {
    renderDebugStatusBanners({
      errorMessage: "",
    });

    expect(screen.queryByTestId("error-banner")).toBeNull();
  });

  it("renders live-state reduction banner on chat tab", () => {
    renderDebugStatusBanners({
      activeTab: "chat",
      liveStateReductionError: {
        eventIndex: 3,
        patchIndex: 7,
      },
    });

    expect(screen.getByText(/Live updates failed for this thread/i)).toBeTruthy();
    expect(screen.getByText(/event 3/i)).toBeTruthy();
    expect(screen.getByText(/patch 7/i)).toBeTruthy();
  });

  it("omits live-state event and patch details when indexes are unavailable", () => {
    renderDebugStatusBanners({
      activeTab: "chat",
      liveStateReductionError: {
        eventIndex: null,
        patchIndex: null,
      },
    });

    expect(screen.getByText(/Live updates failed for this thread/i)).toBeTruthy();
    expect(screen.queryByText(/event /i)).toBeNull();
    expect(screen.queryByText(/patch /i)).toBeNull();
  });

  it("does not render live-state reduction banner on debug tab", () => {
    renderDebugStatusBanners({
      activeTab: "debug",
      liveStateReductionError: {
        eventIndex: 3,
        patchIndex: 7,
      },
    });

    expect(screen.queryByText(/Live updates failed for this thread/i)).toBeNull();
  });
});

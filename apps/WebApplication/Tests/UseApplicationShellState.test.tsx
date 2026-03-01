import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { UNSUPPORTED_PUSH_CLIENT_STATE } from "../Source/Application/Configuration/ApplicationBehaviorConfiguration";
import { type ApplicationRouteState } from "../Source/Application/DomainModel/ApplicationRouteStateMapper";
import {
  type ApplicationShellState,
  useApplicationShellState,
} from "../Source/Application/StateManagement/UseApplicationShellState";
import { PendingThreadMaterializationCoordinator } from "../Source/Features/Threads/StateManagement/PendingThreadMaterializationCoordinator";

interface HarnessProperties {
  initialUiState: ApplicationRouteState;
  initialVisibleChatItems: number;
  onState: (state: ApplicationShellState) => void;
}

function Harness(properties: HarnessProperties): React.JSX.Element {
  const state = useApplicationShellState({
    initialUiState: properties.initialUiState,
    unsupportedPushClientState: UNSUPPORTED_PUSH_CLIENT_STATE,
    initialVisibleChatItems: properties.initialVisibleChatItems,
  });
  properties.onState(state);
  return <div data-testid="application-shell-state-harness" />;
}

interface HarnessInput {
  initialUiState: ApplicationRouteState;
  initialVisibleChatItems: number;
}

function readCapturedApplicationShellState(capturedState: {
  current: ApplicationShellState | null;
}): ApplicationShellState {
  if (!capturedState.current) {
    throw new Error("Expected application shell state to be captured");
  }

  return capturedState.current;
}

function renderApplicationShellStateHarness(input: HarnessInput): ApplicationShellState {
  const capturedState: { current: ApplicationShellState | null } = {
    current: null,
  };

  render(
    <Harness
      initialUiState={input.initialUiState}
      initialVisibleChatItems={input.initialVisibleChatItems}
      onState={(state) => {
        capturedState.current = state;
      }}
    />,
  );

  return readCapturedApplicationShellState(capturedState);
}

describe("useApplicationShellState", () => {
  afterEach(() => {
    cleanup();
  });

  it("initializes selected-thread state and refs from initial route state", () => {
    const applicationShellState = renderApplicationShellStateHarness({
      initialUiState: {
        threadId: "thread-123",
        tab: "debug",
        settingsWorkspaceSection: "debug",
      },
      initialVisibleChatItems: 50,
    });

    expect(applicationShellState.selectedThreadId).toBe("thread-123");
    expect(applicationShellState.selectedThreadIdRef.current).toBe("thread-123");
    expect(applicationShellState.isSelectedThreadLoading).toBe(true);
    expect(applicationShellState.activeTab).toBe("debug");
    expect(applicationShellState.activeTabRef.current).toBe("debug");
    expect(applicationShellState.settingsWorkspaceSection).toBe("debug");
  });

  it("initializes empty-thread route state without selected-thread loading", () => {
    const applicationShellState = renderApplicationShellStateHarness({
      initialUiState: {
        threadId: null,
        tab: "chat",
        settingsWorkspaceSection: "notifications",
      },
      initialVisibleChatItems: 50,
    });

    expect(applicationShellState.selectedThreadId).toBeNull();
    expect(applicationShellState.selectedThreadIdRef.current).toBeNull();
    expect(applicationShellState.isSelectedThreadLoading).toBe(false);
    expect(applicationShellState.activeTab).toBe("chat");
    expect(applicationShellState.activeTabRef.current).toBe("chat");
    expect(applicationShellState.settingsWorkspaceSection).toBe("notifications");
  });

  it("exposes stable owner defaults for shell state and refs", () => {
    const initialVisibleChatItems = 37;
    const applicationShellState = renderApplicationShellStateHarness({
      initialUiState: {
        threadId: null,
        tab: "chat",
        settingsWorkspaceSection: "notifications",
      },
      initialVisibleChatItems,
    });

    expect(applicationShellState.error).toBe("");
    expect(applicationShellState.traceLabel).toBe("capture");
    expect(applicationShellState.traceNote).toBe("");
    expect(applicationShellState.threadRuntimeStatusByThreadIdentifier).toEqual({});
    expect(applicationShellState.threadSidebarRuntimeSummary).toEqual({
      account: null,
      rateLimits: null,
      apps: null,
    });
    expect(applicationShellState.selectedModeKey).toBe("");
    expect(applicationShellState.selectedModelId).toBe("");
    expect(applicationShellState.selectedReasoningEffort).toBe("");
    expect(applicationShellState.settingsWorkspaceSection).toBe("notifications");
    expect(applicationShellState.debugWorkspaceSection).toBe("issues");
    expect(applicationShellState.debugIssueSeverityFilter).toBe("all");
    expect(applicationShellState.debugIssueFilterQuery).toBe("");
    expect(applicationShellState.selectedAgentId).toBe("codex");
    expect(applicationShellState.isBusy).toBe(false);
    expect(applicationShellState.isCoreLoading).toBe(true);
    expect(applicationShellState.waitForReplayResponse).toBe(false);
    expect(applicationShellState.mobileSidebarOpen).toBe(false);
    expect(applicationShellState.desktopSidebarOpen).toBe(true);
    expect(applicationShellState.isChatAtBottom).toBe(true);
    expect(applicationShellState.visibleChatItemLimit).toBe(initialVisibleChatItems);
    expect(applicationShellState.eventsConnectedRef.current).toBe(false);
    expect(applicationShellState.hasHydratedAgentSelectionRef.current).toBe(false);
    expect(applicationShellState.lastCoreRefreshAtRef.current).toBe(0);
    expect(applicationShellState.selectedThreadLoadTokenRef.current).toBe(0);
    expect(applicationShellState.viewportTelemetryLastReportedAtRef.current).toBe(0);
    expect(applicationShellState.loadCoreDataTrackedRef.current).toBeNull();
    expect(applicationShellState.loadSelectedThreadRef.current).toBeNull();
    expect(applicationShellState.keyboardOpenScrollRafRef.current).toBeNull();
    expect(applicationShellState.pendingThreadMaterializationCoordinator).toBeInstanceOf(
      PendingThreadMaterializationCoordinator,
    );
  });

  it("retains ref owners and coordinator instance across rerenders", () => {
    const capturedState: { current: ApplicationShellState | null } = {
      current: null,
    };

    const initialRenderInput: HarnessInput = {
      initialUiState: {
        threadId: "thread-123",
        tab: "debug",
        settingsWorkspaceSection: "debug",
      },
      initialVisibleChatItems: 50,
    };

    const { rerender } = render(
      <Harness
        initialUiState={initialRenderInput.initialUiState}
        initialVisibleChatItems={initialRenderInput.initialVisibleChatItems}
        onState={(state) => {
          capturedState.current = state;
        }}
      />,
    );

    const firstState = readCapturedApplicationShellState(capturedState);
    rerender(
      <Harness
        initialUiState={initialRenderInput.initialUiState}
        initialVisibleChatItems={initialRenderInput.initialVisibleChatItems}
        onState={(state) => {
          capturedState.current = state;
        }}
      />,
    );
    const secondState = readCapturedApplicationShellState(capturedState);

    expect(secondState.selectedThreadIdRef).toBe(firstState.selectedThreadIdRef);
    expect(secondState.activeTabRef).toBe(firstState.activeTabRef);
    expect(secondState.pendingThreadMaterializationCoordinator).toBe(
      firstState.pendingThreadMaterializationCoordinator,
    );
  });
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  createElement,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useState,
} from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type ApplicationShellViewProperties,
  type UseApplicationShellViewPropertiesInput,
  useApplicationShellViewProperties,
} from "../Source/Application/StateManagement/UseApplicationShellViewProperties";
import { ChatScrollStateCoordinator } from "../Source/Features/Chat/StateManagement/ChatScrollStateCoordinator";
import { type ChatModeToolbarProps } from "../Source/Features/Chat/UserInterface/ChatModeToolbar";

/**
 * Direct owner-level tests for callback wiring and side effects exposed by
 * useApplicationShellViewProperties. The goal is to verify stable behavior
 * without coupling to presentational component rendering details.
 */
interface HarnessProperties {
  input: UseApplicationShellViewPropertiesInput;
  onProperties: (properties: ApplicationShellViewProperties) => void;
}

function Harness(properties: HarnessProperties): React.JSX.Element {
  const viewProperties = useApplicationShellViewProperties(properties.input);
  properties.onProperties(viewProperties);
  return createElement("div", {
    "data-testid": "use-application-shell-view-properties-harness",
  });
}

interface ShowOlderMessagesHarnessProperties {
  input: UseApplicationShellViewPropertiesInput;
  initialVisibleChatItemLimit: number;
  onVisibleChatItemLimitChange: (nextVisibleChatItemLimit: number) => void;
}

function ShowOlderMessagesHarness(
  properties: ShowOlderMessagesHarnessProperties,
): React.JSX.Element {
  const [visibleChatItemLimit, setVisibleChatItemLimit] = useState<number>(
    properties.initialVisibleChatItemLimit,
  );
  const viewProperties = useApplicationShellViewProperties({
    ...properties.input,
    setVisibleChatItemLimit,
  });

  properties.onVisibleChatItemLimitChange(visibleChatItemLimit);

  return createElement("button", {
    type: "button",
    "data-testid": "show-older-messages-button",
    onClick: viewProperties.chatWorkspacePaneProperties.onShowOlderMessages,
  });
}

function createStateSetterSpy<ValueType>(): Dispatch<SetStateAction<ValueType>> {
  return vi.fn();
}

function createMutableReference<ValueType>(initialValue: ValueType): MutableRefObject<ValueType> {
  return { current: initialValue };
}

function createChatModeToolbarPropertiesFixture(): ChatModeToolbarProps {
  return {
    canSetCollaborationMode: true,
    canListCollaborationModes: true,
    canListModels: true,
    hasPlanModeOption: true,
    isPlanModeEnabled: false,
    selectedThreadId: "thread-001",
    appDefaultValue: "default",
    appDefaultModel: "Default Model",
    appDefaultReasoningEffort: "Medium",
    selectedModelId: "",
    selectedReasoningEffort: "",
    selectedModeKey: "",
    modelOptionsWithoutAssumedDefault: [],
    effortOptionsWithoutAssumedDefault: [],
    isModeSyncing: false,
    pendingRequestCount: 0,
    onTogglePlanMode: (): void => {},
    onModelChange: (): void => {},
    onReasoningEffortChange: (): void => {},
  };
}

function createScrollableElementFixture(
  scrollHeight: number,
  scrollTop: number,
  clientHeight: number,
): HTMLDivElement {
  const scrollElement = document.createElement("div");
  Object.defineProperty(scrollElement, "scrollHeight", {
    configurable: true,
    value: scrollHeight,
  });
  Object.defineProperty(scrollElement, "clientHeight", {
    configurable: true,
    value: clientHeight,
  });
  scrollElement.scrollTop = scrollTop;
  return scrollElement;
}

function createUseApplicationShellViewPropertiesFixture() {
  const setMobileSidebarOpenSpy = vi.fn((): void => {});
  const setDesktopSidebarOpenSpy = vi.fn((): void => {});
  const setSettingsWorkspaceSectionSpy = vi.fn((): void => {});
  const enablePushNotificationsFromToolbarSpy = vi.fn(async (): Promise<void> => {});
  const refreshPushSettingsDiagnosticsSpy = vi.fn(async (): Promise<void> => {});
  const sendPushTestNotificationFromSettingsSpy = vi.fn(async (): Promise<void> => {});
  const refreshCoreDataAndSelectedThreadSpy = vi.fn(async (): Promise<void> => {});
  const setActiveTabSpy = vi.fn((): void => {});
  const toggleThemeSpy = vi.fn((): void => {});
  const openDebugFromErrorBannerSpy = vi.fn((): void => {});
  const setErrorMessageSpy = vi.fn((): void => {});
  const setIsChatAtBottomSpy = vi.fn((): void => {});
  const submitPendingRequestSpy = vi.fn(async (): Promise<void> => {});
  const skipPendingRequestSpy = vi.fn(async (): Promise<void> => {});
  const runInterruptSpy = vi.fn(async (): Promise<void> => {});
  const steerMessageSpy = vi.fn(async (): Promise<void> => {});
  const submitMessageSpy = vi.fn(async (): Promise<void> => {});
  const setDebugWorkspaceSectionSpy = vi.fn((): void => {});
  const setSelectedDebugIssueIdSpy = vi.fn((): void => {});
  const setDebugIssueSeverityFilterSpy = vi.fn((): void => {});
  const setDebugIssueFilterQuerySpy = vi.fn((): void => {});
  const clearDebugIssuesFromDebugPanelSpy = vi.fn((): void => {});
  const setSelectedHistoryIdSpy = vi.fn((): void => {});
  const setWaitForReplayResponseSpy = vi.fn((): void => {});
  const replayHistoryEntryFromDetailSpy = vi.fn((): void => {});
  const setTraceLabelSpy = vi.fn((): void => {});
  const setTraceNoteSpy = vi.fn((): void => {});
  const startTraceFromDebugPanelSpy = vi.fn((): void => {});
  const markTraceFromDebugPanelSpy = vi.fn((): void => {});
  const stopTraceFromDebugPanelSpy = vi.fn((): void => {});
  const setApiSessionTokenDraftSpy = vi.fn((): void => {});
  const setApiSessionBootstrapErrorSpy = vi.fn((): void => {});
  const submitApiSessionTokenSpy = vi.fn(async (): Promise<void> => {});
  const scrollReference = createMutableReference<HTMLDivElement | null>(null);
  const chatContentReference = createMutableReference<HTMLDivElement | null>(null);
  const setVisibleChatItemLimitSpy = createStateSetterSpy<number>();

  const input: UseApplicationShellViewPropertiesInput = {
    health: null,
    activeTab: "chat",
    settingsWorkspaceSection: "notifications",
    desktopSidebarOpen: false,
    selectedThreadLabel: "Selected Thread",
    hasSelectedThread: true,
    activeThreadAgentId: "codex",
    activeAgentLabel: "Codex",
    isGenerating: false,
    pushClientState: {
      supported: true,
      serviceWorkerRegistered: true,
      permission: "granted",
      subscribed: true,
    },
    pushStatus: null,
    latestPushReceipt: null,
    latestPushSend: null,
    pushLocalCertificateAuthorityStatus: null,
    pushSettingsErrorMessage: "",
    pushTestResult: null,
    latestTurnId: null,
    isEnablingPushNotifications: false,
    isRefreshingPushSettings: false,
    isSendingPushTestNotification: false,
    isBusy: false,
    theme: "dark",
    setMobileSidebarOpen: setMobileSidebarOpenSpy,
    setDesktopSidebarOpen: setDesktopSidebarOpenSpy,
    setSettingsWorkspaceSection: setSettingsWorkspaceSectionSpy,
    enablePushNotificationsFromToolbar: enablePushNotificationsFromToolbarSpy,
    refreshPushSettingsDiagnostics: refreshPushSettingsDiagnosticsSpy,
    sendPushTestNotificationFromSettings: sendPushTestNotificationFromSettingsSpy,
    refreshCoreDataAndSelectedThread: refreshCoreDataAndSelectedThreadSpy,
    setActiveTab: setActiveTabSpy,
    toggleTheme: toggleThemeSpy,
    renderAgentFavicon: vi.fn(() => null),
    errorMessage: "runtime-error",
    errorBannerDetails: {
      operation: "refresh",
      message: "request failed",
      actionId: "action-123",
      requestId: "request-123",
      errorId: "error-123",
    },
    openDebugFromErrorBanner: openDebugFromErrorBannerSpy,
    setErrorMessage: setErrorMessageSpy,
    liveStateReductionError: null,
    chatSurfaceState: "ready",
    selectedThreadId: "thread-001",
    isCoreLoading: false,
    isSelectedThreadLoading: false,
    availableAgentIds: ["codex"],
    turnCount: 1,
    scrollRef: scrollReference,
    chatContentRef: chatContentReference,
    visibleConversationItems: [],
    hasHiddenChatItems: false,
    firstVisibleChatItemIndex: 0,
    setVisibleChatItemLimit: setVisibleChatItemLimitSpy,
    conversationItemCount: 100,
    visibleChatItemsStep: 25,
    isChatAtBottom: false,
    chatScrollStateCoordinator: new ChatScrollStateCoordinator(16),
    setIsChatAtBottom: setIsChatAtBottomSpy,
    activeRequest: null,
    canSubmitUserInputForActiveAgent: false,
    answerDraft: {},
    handleAnswerChange: vi.fn((): void => {}),
    submitPendingRequest: submitPendingRequestSpy,
    skipPendingRequest: skipPendingRequestSpy,
    selectedAgentLabel: "Codex",
    runInterrupt: runInterruptSpy,
    steerMessage: steerMessageSpy,
    submitMessage: submitMessageSpy,
    chatModeToolbarProperties: createChatModeToolbarPropertiesFixture(),
    debugWorkspaceSection: "issues",
    setDebugWorkspaceSection: setDebugWorkspaceSectionSpy,
    debugErrorIssueCount: 0,
    debugWarningIssueCount: 0,
    runtimeRequestErrorOperationMetrics: [],
    filteredDebugIssues: [],
    selectedDebugIssue: null,
    selectedDebugIssueId: "",
    debugIssueSeverityFilter: "all",
    debugIssueFilterQuery: "",
    debugErrorSessionId: "",
    debugErrorSessionLogPath: "",
    setSelectedDebugIssueId: setSelectedDebugIssueIdSpy,
    setDebugIssueSeverityFilter: setDebugIssueSeverityFilterSpy,
    setDebugIssueFilterQuery: setDebugIssueFilterQuerySpy,
    clearDebugIssuesFromDebugPanel: clearDebugIssuesFromDebugPanelSpy,
    debugHistoryEntryListItems: [],
    selectedHistoryId: "",
    selectedHistoryDetailId: null,
    historyDetailPayloadText: "",
    waitForReplayResponse: false,
    setSelectedHistoryId: setSelectedHistoryIdSpy,
    setWaitForReplayResponse: setWaitForReplayResponseSpy,
    replayHistoryEntryFromDetail: replayHistoryEntryFromDetailSpy,
    streamEventCount: 0,
    streamEventCards: [],
    isTraceRecording: false,
    traceLabel: "",
    traceNote: "",
    setTraceLabel: setTraceLabelSpy,
    setTraceNote: setTraceNoteSpy,
    startTraceFromDebugPanel: startTraceFromDebugPanelSpy,
    markTraceFromDebugPanel: markTraceFromDebugPanelSpy,
    stopTraceFromDebugPanel: stopTraceFromDebugPanelSpy,
    recentTraceSummaries: [],
    apiSessionTokenDraft: "",
    setApiSessionTokenDraft: setApiSessionTokenDraftSpy,
    apiSessionBootstrapError: "invalid-token",
    setApiSessionBootstrapError: setApiSessionBootstrapErrorSpy,
    submitApiSessionToken: submitApiSessionTokenSpy,
    isApiSessionBootstrapPending: false,
  };

  return {
    input,
    scrollReference,
    setMobileSidebarOpenSpy,
    setDesktopSidebarOpenSpy,
    setSettingsWorkspaceSectionSpy,
    enablePushNotificationsFromToolbarSpy,
    refreshPushSettingsDiagnosticsSpy,
    sendPushTestNotificationFromSettingsSpy,
    refreshCoreDataAndSelectedThreadSpy,
    setActiveTabSpy,
    toggleThemeSpy,
    openDebugFromErrorBannerSpy,
    setErrorMessageSpy,
    setIsChatAtBottomSpy,
    setApiSessionTokenDraftSpy,
    setApiSessionBootstrapErrorSpy,
  };
}

function renderViewProperties(
  input: UseApplicationShellViewPropertiesInput,
): ApplicationShellViewProperties {
  const capturedProperties: { current: ApplicationShellViewProperties | null } = {
    current: null,
  };

  render(
    createElement(Harness, {
      input,
      onProperties: (properties) => {
        capturedProperties.current = properties;
      },
    }),
  );

  if (!capturedProperties.current) {
    throw new Error("Expected application shell view properties to be captured.");
  }

  return capturedProperties.current;
}

function renderViewPropertiesHarness(input: UseApplicationShellViewPropertiesInput): {
  rerender: (nextInput: UseApplicationShellViewPropertiesInput) => void;
  readLatestProperties: () => ApplicationShellViewProperties;
} {
  const capturedProperties: { current: ApplicationShellViewProperties | null } = {
    current: null,
  };

  const renderResult = render(
    createElement(Harness, {
      input,
      onProperties: (properties) => {
        capturedProperties.current = properties;
      },
    }),
  );

  return {
    rerender: (nextInput) => {
      renderResult.rerender(
        createElement(Harness, {
          input: nextInput,
          onProperties: (properties) => {
            capturedProperties.current = properties;
          },
        }),
      );
    },
    readLatestProperties: () => {
      if (!capturedProperties.current) {
        throw new Error("Expected application shell view properties to be captured.");
      }

      return capturedProperties.current;
    },
  };
}

function renderShowOlderMessagesHarness(
  input: UseApplicationShellViewPropertiesInput,
  initialVisibleChatItemLimit: number,
): {
  clickShowOlderMessages: () => void;
  getLatestVisibleChatItemLimit: () => number;
} {
  const visibleChatItemLimitValues: number[] = [];

  render(
    createElement(ShowOlderMessagesHarness, {
      input,
      initialVisibleChatItemLimit,
      onVisibleChatItemLimitChange: (nextVisibleChatItemLimit) => {
        visibleChatItemLimitValues.push(nextVisibleChatItemLimit);
      },
    }),
  );

  return {
    clickShowOlderMessages: () => {
      fireEvent.click(screen.getByTestId("show-older-messages-button"));
    },
    getLatestVisibleChatItemLimit: () => {
      const latestVisibleChatItemLimit = visibleChatItemLimitValues.at(-1);
      if (latestVisibleChatItemLimit === undefined) {
        throw new Error("Expected visible chat item limit to be captured.");
      }

      return latestVisibleChatItemLimit;
    },
  };
}

describe("useApplicationShellViewProperties", () => {
  afterEach(() => {
    cleanup();
  });

  it("wires header actions to the expected owner callbacks", () => {
    const fixture = createUseApplicationShellViewPropertiesFixture();
    const viewProperties = renderViewProperties(fixture.input);
    const headerProperties = viewProperties.applicationHeaderBarProperties;

    headerProperties.onOpenMobileSidebar();
    expect(fixture.setMobileSidebarOpenSpy).toHaveBeenCalledWith(true);
    expect(fixture.setActiveTabSpy).toHaveBeenLastCalledWith("chat");

    headerProperties.onOpenDesktopSidebar();
    expect(fixture.setDesktopSidebarOpenSpy).toHaveBeenCalledWith(true);
    expect(fixture.setActiveTabSpy).toHaveBeenLastCalledWith("chat");

    headerProperties.onRefresh();
    expect(fixture.refreshCoreDataAndSelectedThreadSpy).toHaveBeenCalledTimes(1);

    headerProperties.onToggleTheme();
    expect(fixture.toggleThemeSpy).toHaveBeenCalledTimes(1);

    headerProperties.onToggleSettingsTab();
    expect(fixture.setActiveTabSpy).toHaveBeenLastCalledWith("debug");
  });

  it("toggles settings tab back to chat when settings tab is already active", () => {
    const fixture = createUseApplicationShellViewPropertiesFixture();
    fixture.input.activeTab = "debug";
    const viewProperties = renderViewProperties(fixture.input);

    viewProperties.applicationHeaderBarProperties.onToggleSettingsTab();

    expect(fixture.setActiveTabSpy).toHaveBeenCalledWith("chat");
  });

  it("clears the debug banner error when opening debug from the banner", () => {
    const fixture = createUseApplicationShellViewPropertiesFixture();
    const viewProperties = renderViewProperties(fixture.input);

    viewProperties.debugStatusBannersProperties.onOpenDebugFromErrorBanner();

    expect(fixture.openDebugFromErrorBannerSpy).toHaveBeenCalledTimes(1);
    expect(fixture.setErrorMessageSpy).toHaveBeenCalledWith("");
  });

  it("clears the debug banner error when dismissing the banner", () => {
    const fixture = createUseApplicationShellViewPropertiesFixture();
    const viewProperties = renderViewProperties(fixture.input);

    viewProperties.debugStatusBannersProperties.onDismissErrorBanner();

    expect(fixture.setErrorMessageSpy).toHaveBeenCalledWith("");
  });

  it("pins chat scroll to the bottom and marks chat as at-bottom when jump-to-bottom is requested", () => {
    const fixture = createUseApplicationShellViewPropertiesFixture();
    const scrollElement = createScrollableElementFixture(420, 40, 200);
    fixture.scrollReference.current = scrollElement;
    const viewProperties = renderViewProperties(fixture.input);

    viewProperties.chatWorkspacePaneProperties.onJumpToBottom();

    expect(scrollElement.scrollTop).toBe(420);
    expect(fixture.setIsChatAtBottomSpy).toHaveBeenCalledWith(true);
  });

  it("does not mark chat as at-bottom when jump-to-bottom has no scroll element", () => {
    const fixture = createUseApplicationShellViewPropertiesFixture();
    const viewProperties = renderViewProperties(fixture.input);

    viewProperties.chatWorkspacePaneProperties.onJumpToBottom();

    expect(fixture.setIsChatAtBottomSpy).not.toHaveBeenCalled();
  });

  it("increases the visible chat item limit by step and caps at the total conversation item count", () => {
    const fixture = createUseApplicationShellViewPropertiesFixture();
    fixture.input.conversationItemCount = 100;
    fixture.input.visibleChatItemsStep = 25;

    const harness = renderShowOlderMessagesHarness(fixture.input, 50);

    harness.clickShowOlderMessages();
    expect(harness.getLatestVisibleChatItemLimit()).toBe(75);

    harness.clickShowOlderMessages();
    expect(harness.getLatestVisibleChatItemLimit()).toBe(100);

    harness.clickShowOlderMessages();
    expect(harness.getLatestVisibleChatItemLimit()).toBe(100);
  });

  it("clears api session bootstrap error after token draft changes when an error is currently shown", () => {
    const fixture = createUseApplicationShellViewPropertiesFixture();
    const viewProperties = renderViewProperties(fixture.input);

    viewProperties.apiSessionBootstrapOverlayProperties.onApiTokenDraftChange("next-token");

    expect(fixture.setApiSessionTokenDraftSpy).toHaveBeenCalledWith("next-token");
    expect(fixture.setApiSessionBootstrapErrorSpy).toHaveBeenCalledWith("");
  });

  it("keeps api session bootstrap error untouched after token draft changes when there is no active error", () => {
    const fixture = createUseApplicationShellViewPropertiesFixture();
    fixture.input.apiSessionBootstrapError = "";
    const viewProperties = renderViewProperties(fixture.input);

    viewProperties.apiSessionBootstrapOverlayProperties.onApiTokenDraftChange("next-token");

    expect(fixture.setApiSessionTokenDraftSpy).toHaveBeenCalledWith("next-token");
    expect(fixture.setApiSessionBootstrapErrorSpy).not.toHaveBeenCalled();
  });

  it("preserves chat and header property identity when only debug workspace input changes", () => {
    const fixture = createUseApplicationShellViewPropertiesFixture();
    const harness = renderViewPropertiesHarness(fixture.input);

    const initialProperties = harness.readLatestProperties();
    harness.rerender({
      ...fixture.input,
      debugIssueFilterQuery: "request-id:abc123",
    });
    const nextProperties = harness.readLatestProperties();

    expect(nextProperties.applicationHeaderBarProperties).toBe(
      initialProperties.applicationHeaderBarProperties,
    );
    expect(nextProperties.chatWorkspacePaneProperties).toBe(
      initialProperties.chatWorkspacePaneProperties,
    );
    expect(nextProperties.settingsWorkspacePaneProperties).not.toBe(
      initialProperties.settingsWorkspacePaneProperties,
    );
  });

  it("preserves non-bootstrap property identity when only api bootstrap input changes", () => {
    const fixture = createUseApplicationShellViewPropertiesFixture();
    const harness = renderViewPropertiesHarness(fixture.input);

    const initialProperties = harness.readLatestProperties();
    harness.rerender({
      ...fixture.input,
      apiSessionTokenDraft: "token-v2",
    });
    const nextProperties = harness.readLatestProperties();

    expect(nextProperties.applicationHeaderBarProperties).toBe(
      initialProperties.applicationHeaderBarProperties,
    );
    expect(nextProperties.chatWorkspacePaneProperties).toBe(
      initialProperties.chatWorkspacePaneProperties,
    );
    expect(nextProperties.settingsWorkspacePaneProperties).toBe(
      initialProperties.settingsWorkspacePaneProperties,
    );
    expect(nextProperties.apiSessionBootstrapOverlayProperties).not.toBe(
      initialProperties.apiSessionBootstrapOverlayProperties,
    );
  });
});

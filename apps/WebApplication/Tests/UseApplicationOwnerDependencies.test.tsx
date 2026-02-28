import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type ApplicationOwnerDependencies,
  type UseApplicationOwnerDependenciesInput,
  useApplicationOwnerDependencies,
} from "../Source/Application/StateManagement/UseApplicationOwnerDependencies";
import { type CapabilitySnapshotRecord } from "../Source/Features/Capabilities/DataAccess/CapabilitySnapshotCache";
import { ModeSelectionStateResolver } from "../Source/Features/Chat/DomainModel/ModeSelectionStateResolver";
import { type PushClientState } from "../Source/Features/PushNotifications/DomainModel/PushClientContracts";
import { LastViewedThreadPreferenceStore } from "../Source/Features/Threads/DataAccess/LastViewedThreadPreferenceStore";
import { ThreadDisplayNamePreferenceStore } from "../Source/Features/Threads/DataAccess/ThreadDisplayNamePreferenceStore";

interface HarnessProperties {
  input: UseApplicationOwnerDependenciesInput;
}

let latestOwnerDependencies: ApplicationOwnerDependencies<CapabilitySnapshotRecord> | null = null;

function Harness(properties: HarnessProperties): React.JSX.Element {
  latestOwnerDependencies = useApplicationOwnerDependencies<CapabilitySnapshotRecord>(
    properties.input,
  );
  return <div data-testid="application-owner-dependencies-harness" />;
}

function readLatestOwnerDependencies(): ApplicationOwnerDependencies<CapabilitySnapshotRecord> {
  if (!latestOwnerDependencies) {
    throw new Error("Expected owner dependencies snapshot");
  }
  return latestOwnerDependencies;
}

function createUnsupportedPushClientState(): PushClientState {
  return {
    supported: false,
    serviceWorkerRegistered: false,
    permission: "unsupported",
    subscribed: false,
  };
}

function createSupportedPushClientState(): PushClientState {
  return {
    supported: true,
    serviceWorkerRegistered: true,
    permission: "granted",
    subscribed: true,
  };
}

function createBaseInput(): UseApplicationOwnerDependenciesInput {
  return {
    setErrorMessage: vi.fn(),
    modeSelectionStateResolver: new ModeSelectionStateResolver(),
    unsupportedPushClientState: createUnsupportedPushClientState(),
    lastViewedThreadPreferenceStore: new LastViewedThreadPreferenceStore(
      "test.last-viewed-thread.preference",
    ),
    threadDisplayNamePreferenceStore: new ThreadDisplayNamePreferenceStore(
      "test.thread-display-name.preference",
    ),
    threadOnlyHistoryMethods: ["read-thread"],
    eventRefreshScheduleDelayMilliseconds: 250,
    mobileVisualViewportKeyboardOpenDeltaPx: 80,
    mobileLayoutMaximumWidthPx: 900,
    mobileSidebarSwipeEdgePx: 24,
    mobileSidebarSwipeTriggerPx: 120,
    mobileSidebarSwipeMaximumVerticalDriftPx: 45,
    mobileSidebarSwipeCancelNegativePx: 30,
    capabilitySnapshotRefreshIntervalMilliseconds: 30_000,
    chatScrollBottomThresholdPx: 140,
    readThreadRetryMaximumAttempts: 5,
    readThreadRetryBaseDelayMilliseconds: 250,
    readThreadRetryMaximumDelayMilliseconds: 2_000,
    threadQueryCacheTimeToLiveMilliseconds: 30_000,
    threadQueryCacheMaximumEntries: 200,
    pushDiagnosticsRefreshTimeToLiveMilliseconds: 30_000,
  };
}

function expectSingletonOwnersStable(
  previousDependencies: ApplicationOwnerDependencies<CapabilitySnapshotRecord>,
  nextDependencies: ApplicationOwnerDependencies<CapabilitySnapshotRecord>,
): void {
  expect(nextDependencies.apiAuthenticationErrorClassifier).toBe(
    previousDependencies.apiAuthenticationErrorClassifier,
  );
  expect(nextDependencies.dateValueFormatter).toBe(previousDependencies.dateValueFormatter);
  expect(nextDependencies.capabilityServerClient).toBe(previousDependencies.capabilityServerClient);
  expect(nextDependencies.webShellSessionBootstrapClient).toBe(
    previousDependencies.webShellSessionBootstrapClient,
  );
  expect(nextDependencies.apiSessionBootstrapCoordinator).toBe(
    previousDependencies.apiSessionBootstrapCoordinator,
  );
  expect(nextDependencies.coreDataRefreshConcurrencyCoordinator).toBe(
    previousDependencies.coreDataRefreshConcurrencyCoordinator,
  );
  expect(nextDependencies.eventStreamConnectionCoordinator).toBe(
    previousDependencies.eventStreamConnectionCoordinator,
  );
  expect(nextDependencies.pageTouchOverscrollGuardCoordinator).toBe(
    previousDependencies.pageTouchOverscrollGuardCoordinator,
  );
  expect(nextDependencies.chatServerClient).toBe(previousDependencies.chatServerClient);
  expect(nextDependencies.selectedThreadRefreshConcurrencyCoordinator).toBe(
    previousDependencies.selectedThreadRefreshConcurrencyCoordinator,
  );
  expect(nextDependencies.readThreadStateMerger).toBe(previousDependencies.readThreadStateMerger);
  expect(nextDependencies.pendingUserInputRequestSelector).toBe(
    previousDependencies.pendingUserInputRequestSelector,
  );
  expect(nextDependencies.userInterfaceActionRequestBuilder).toBe(
    previousDependencies.userInterfaceActionRequestBuilder,
  );
  expect(nextDependencies.pendingUserInputAnswerBuilder).toBe(
    previousDependencies.pendingUserInputAnswerBuilder,
  );
  expect(nextDependencies.chatRequestActionCoordinator).toBe(
    previousDependencies.chatRequestActionCoordinator,
  );
  expect(nextDependencies.conversationItemFlattener).toBe(
    previousDependencies.conversationItemFlattener,
  );
  expect(nextDependencies.debugServerClient).toBe(previousDependencies.debugServerClient);
  expect(nextDependencies.debugWorkspaceDataReader).toBe(
    previousDependencies.debugWorkspaceDataReader,
  );
  expect(nextDependencies.debugWorkspaceStateStore).toBe(
    previousDependencies.debugWorkspaceStateStore,
  );
  expect(nextDependencies.debugWorkspaceActionCoordinator).toBe(
    previousDependencies.debugWorkspaceActionCoordinator,
  );
  expect(nextDependencies.debugIssueStateResolver).toBe(
    previousDependencies.debugIssueStateResolver,
  );
  expect(nextDependencies.threadMutationServerClient).toBe(
    previousDependencies.threadMutationServerClient,
  );
  expect(nextDependencies.threadMutationActionCoordinator).toBe(
    previousDependencies.threadMutationActionCoordinator,
  );
  expect(nextDependencies.threadDisplayNameStateOwner).toBe(
    previousDependencies.threadDisplayNameStateOwner,
  );
  expect(nextDependencies.lastViewedThreadPreferenceStore).toBe(
    previousDependencies.lastViewedThreadPreferenceStore,
  );
  expect(nextDependencies.pushServerClient).toBe(previousDependencies.pushServerClient);
  expect(nextDependencies.pushClientStateManager).toBe(previousDependencies.pushClientStateManager);
}

function expectConfiguredOwnersStable(
  previousDependencies: ApplicationOwnerDependencies<CapabilitySnapshotRecord>,
  nextDependencies: ApplicationOwnerDependencies<CapabilitySnapshotRecord>,
): void {
  expect(nextDependencies.eventStreamRefreshDecisionEngine).toBe(
    previousDependencies.eventStreamRefreshDecisionEngine,
  );
  expect(nextDependencies.eventRefreshScheduler).toBe(previousDependencies.eventRefreshScheduler);
  expect(nextDependencies.runtimeViewportSizingCoordinator).toBe(
    previousDependencies.runtimeViewportSizingCoordinator,
  );
  expect(nextDependencies.mobileSidebarSwipeCoordinator).toBe(
    previousDependencies.mobileSidebarSwipeCoordinator,
  );
  expect(nextDependencies.capabilitySnapshotCache).toBe(
    previousDependencies.capabilitySnapshotCache,
  );
  expect(nextDependencies.modeSelectionSyncCoordinator).toBe(
    previousDependencies.modeSelectionSyncCoordinator,
  );
  expect(nextDependencies.trackedUserInterfaceErrorReporter).toBe(
    previousDependencies.trackedUserInterfaceErrorReporter,
  );
  expect(nextDependencies.chatScrollStateCoordinator).toBe(
    previousDependencies.chatScrollStateCoordinator,
  );
  expect(nextDependencies.collaborationModeActionCoordinator).toBe(
    previousDependencies.collaborationModeActionCoordinator,
  );
  expect(nextDependencies.selectedThreadDataRefreshCoordinator).toBe(
    previousDependencies.selectedThreadDataRefreshCoordinator,
  );
  expect(nextDependencies.threadListStateController).toBe(
    previousDependencies.threadListStateController,
  );
  expect(nextDependencies.pushNotificationToolbarActionCoordinator).toBe(
    previousDependencies.pushNotificationToolbarActionCoordinator,
  );
  expect(nextDependencies.pushDiagnosticsRefreshStateOwner).toBe(
    previousDependencies.pushDiagnosticsRefreshStateOwner,
  );
}

function expectConfiguredOwnersRecreated(
  previousDependencies: ApplicationOwnerDependencies<CapabilitySnapshotRecord>,
  nextDependencies: ApplicationOwnerDependencies<CapabilitySnapshotRecord>,
): void {
  expect(nextDependencies.eventStreamRefreshDecisionEngine).not.toBe(
    previousDependencies.eventStreamRefreshDecisionEngine,
  );
  expect(nextDependencies.eventRefreshScheduler).not.toBe(
    previousDependencies.eventRefreshScheduler,
  );
  expect(nextDependencies.runtimeViewportSizingCoordinator).not.toBe(
    previousDependencies.runtimeViewportSizingCoordinator,
  );
  expect(nextDependencies.mobileSidebarSwipeCoordinator).not.toBe(
    previousDependencies.mobileSidebarSwipeCoordinator,
  );
  expect(nextDependencies.capabilitySnapshotCache).not.toBe(
    previousDependencies.capabilitySnapshotCache,
  );
  expect(nextDependencies.modeSelectionSyncCoordinator).not.toBe(
    previousDependencies.modeSelectionSyncCoordinator,
  );
  expect(nextDependencies.trackedUserInterfaceErrorReporter).not.toBe(
    previousDependencies.trackedUserInterfaceErrorReporter,
  );
  expect(nextDependencies.chatScrollStateCoordinator).not.toBe(
    previousDependencies.chatScrollStateCoordinator,
  );
  expect(nextDependencies.collaborationModeActionCoordinator).not.toBe(
    previousDependencies.collaborationModeActionCoordinator,
  );
  expect(nextDependencies.selectedThreadDataRefreshCoordinator).not.toBe(
    previousDependencies.selectedThreadDataRefreshCoordinator,
  );
  expect(nextDependencies.threadListStateController).not.toBe(
    previousDependencies.threadListStateController,
  );
  expect(nextDependencies.pushNotificationToolbarActionCoordinator).not.toBe(
    previousDependencies.pushNotificationToolbarActionCoordinator,
  );
  expect(nextDependencies.pushDiagnosticsRefreshStateOwner).not.toBe(
    previousDependencies.pushDiagnosticsRefreshStateOwner,
  );
}

describe("useApplicationOwnerDependencies", () => {
  afterEach(() => {
    cleanup();
    latestOwnerDependencies = null;
  });

  it("keeps singleton owners stable when input dependencies are unchanged", () => {
    const baseInput = createBaseInput();
    const { rerender } = render(<Harness input={baseInput} />);
    const firstDependencies = readLatestOwnerDependencies();

    const sameDependencyInput: UseApplicationOwnerDependenciesInput = {
      ...baseInput,
      threadOnlyHistoryMethods: baseInput.threadOnlyHistoryMethods,
      unsupportedPushClientState: baseInput.unsupportedPushClientState,
      modeSelectionStateResolver: baseInput.modeSelectionStateResolver,
      setErrorMessage: baseInput.setErrorMessage,
    };

    rerender(<Harness input={sameDependencyInput} />);
    const secondDependencies = readLatestOwnerDependencies();

    expectSingletonOwnersStable(firstDependencies, secondDependencies);
    expectConfiguredOwnersStable(firstDependencies, secondDependencies);
  });

  it("recreates dependency-owned coordinators when their composition inputs change", () => {
    const baseInput = createBaseInput();
    const { rerender } = render(<Harness input={baseInput} />);
    const firstDependencies = readLatestOwnerDependencies();

    const changedInput: UseApplicationOwnerDependenciesInput = {
      ...baseInput,
      setErrorMessage: vi.fn(),
      modeSelectionStateResolver: new ModeSelectionStateResolver(),
      unsupportedPushClientState: createSupportedPushClientState(),
      threadOnlyHistoryMethods: ["read-thread", "stream-event"],
      eventRefreshScheduleDelayMilliseconds: baseInput.eventRefreshScheduleDelayMilliseconds + 1,
      mobileVisualViewportKeyboardOpenDeltaPx:
        baseInput.mobileVisualViewportKeyboardOpenDeltaPx + 1,
      mobileLayoutMaximumWidthPx: baseInput.mobileLayoutMaximumWidthPx + 1,
      mobileSidebarSwipeEdgePx: baseInput.mobileSidebarSwipeEdgePx + 1,
      mobileSidebarSwipeTriggerPx: baseInput.mobileSidebarSwipeTriggerPx + 1,
      mobileSidebarSwipeMaximumVerticalDriftPx:
        baseInput.mobileSidebarSwipeMaximumVerticalDriftPx + 1,
      mobileSidebarSwipeCancelNegativePx: baseInput.mobileSidebarSwipeCancelNegativePx + 1,
      capabilitySnapshotRefreshIntervalMilliseconds:
        baseInput.capabilitySnapshotRefreshIntervalMilliseconds + 1,
      chatScrollBottomThresholdPx: baseInput.chatScrollBottomThresholdPx + 1,
      readThreadRetryMaximumAttempts: baseInput.readThreadRetryMaximumAttempts + 1,
      readThreadRetryBaseDelayMilliseconds: baseInput.readThreadRetryBaseDelayMilliseconds + 1,
      readThreadRetryMaximumDelayMilliseconds:
        baseInput.readThreadRetryMaximumDelayMilliseconds + 1,
      threadQueryCacheTimeToLiveMilliseconds: baseInput.threadQueryCacheTimeToLiveMilliseconds + 1,
      threadQueryCacheMaximumEntries: baseInput.threadQueryCacheMaximumEntries + 1,
      pushDiagnosticsRefreshTimeToLiveMilliseconds:
        baseInput.pushDiagnosticsRefreshTimeToLiveMilliseconds + 1,
    };

    rerender(<Harness input={changedInput} />);
    const secondDependencies = readLatestOwnerDependencies();

    expectSingletonOwnersStable(firstDependencies, secondDependencies);
    expectConfiguredOwnersRecreated(firstDependencies, secondDependencies);
  });
});

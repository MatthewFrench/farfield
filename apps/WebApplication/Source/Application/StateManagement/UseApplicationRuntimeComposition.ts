import { useCallback, useEffect } from "react";
import {
  buildApplicationChatFeatureCompositionInput,
  buildApplicationDebugFeatureCompositionInput,
  buildApplicationPushFeatureCompositionInput,
  buildApplicationRefreshEffectsInput,
  buildApplicationShellCompositionInput,
  buildApplicationSynchronizationEffectsInput,
  buildEventStreamEffectsInput,
  buildModeAndPendingRequestEffectsInput,
  buildSelectedThreadLifecycleEffectsInput,
  buildViewportShellEffectsInput,
  createApplicationRuntimeCompositionContext,
} from "@/Application/StateManagement/ApplicationRuntimeCompositionDependencyBuilders";
import { useApplicationChatFeatureComposition } from "@/Application/StateManagement/UseApplicationChatFeatureComposition";
import { useApplicationDebugFeatureComposition } from "@/Application/StateManagement/UseApplicationDebugFeatureComposition";
import { useApplicationPushFeatureComposition } from "@/Application/StateManagement/UseApplicationPushFeatureComposition";
import { useApplicationRefreshEffects } from "@/Application/StateManagement/UseApplicationRefreshEffects";
import {
  type ApplicationRuntimeComposition,
  type UseApplicationRuntimeCompositionInput,
} from "@/Application/StateManagement/UseApplicationRuntimeCompositionContracts";
import { useApplicationRuntimeRefreshOrchestration } from "@/Application/StateManagement/UseApplicationRuntimeRefreshOrchestration";
import { useApplicationShellComposition } from "@/Application/StateManagement/UseApplicationShellComposition";
import { useApplicationSynchronizationEffects } from "@/Application/StateManagement/UseApplicationSynchronizationEffects";
import { useEventStreamEffects } from "@/Application/StateManagement/UseEventStreamEffects";
import { useViewportShellEffects } from "@/Application/StateManagement/UseViewportShellEffects";
import { useModeAndPendingRequestEffects } from "@/Features/Chat/StateManagement/UseModeAndPendingRequestEffects";
import { useSelectedThreadLifecycleEffects } from "@/Features/Chat/StateManagement/UseSelectedThreadLifecycleEffects";
import { useThreadRuntimeStatusHydrationEffect } from "@/Features/Threads/StateManagement/UseThreadRuntimeStatusHydrationEffect";

export type { ApplicationRuntimeComposition, UseApplicationRuntimeCompositionInput };

export function useApplicationRuntimeComposition(
  input: UseApplicationRuntimeCompositionInput,
): ApplicationRuntimeComposition {
  // Effect owners retain stable subscriptions and always read the latest loader refs from this runtime owner.
  const loadCoreDataTrackedRef = input.applicationShellState.loadCoreDataTrackedRef;
  const loadSelectedThreadRef = input.applicationShellState.loadSelectedThreadRef;
  loadCoreDataTrackedRef.current = input.coreDataLoaders.loadCoreDataTracked;
  loadSelectedThreadRef.current = input.loadSelectedThreadTracked;

  const runtimeCompositionContext = createApplicationRuntimeCompositionContext(input);

  useEffect(() => {
    const selectedThread = input.applicationDerivedState.selectedThread;
    if (selectedThread === null) {
      return;
    }
    const selectedThreadProjectPath = selectedThread.cwd ?? selectedThread.path ?? null;
    if (selectedThreadProjectPath === null || selectedThreadProjectPath.trim().length === 0) {
      return;
    }
    input.applicationOwnerDependencies.threadComposerProjectContextStateOwner.writeCurrentProjectPath(
      selectedThreadProjectPath,
    );
  }, [
    input.applicationDerivedState.selectedThread,
    input.applicationOwnerDependencies.threadComposerProjectContextStateOwner,
  ]);

  const {
    loadSelectedThreadIfPresentFromRuntimeState,
    refreshSelectedThreadIncrementalIfPresent,
    refreshCoreDataAndSelectedThread,
  } = useApplicationRuntimeRefreshOrchestration({
    applicationShellState: input.applicationShellState,
    loadCoreDataTracked: input.coreDataLoaders.loadCoreDataTracked,
    loadSelectedThreadTracked: input.loadSelectedThreadTracked,
    handleRuntimeRequestError: input.runtimeRequestHandlers.handleRuntimeRequestError,
  });

  const pushFeatureComposition = useApplicationPushFeatureComposition(
    buildApplicationPushFeatureCompositionInput(runtimeCompositionContext, {
      loadSelectedThreadIfPresentFromRuntimeState,
    }),
  );

  useViewportShellEffects(buildViewportShellEffectsInput(runtimeCompositionContext));

  useApplicationRefreshEffects(
    buildApplicationRefreshEffectsInput(runtimeCompositionContext, {
      refreshCoreDataAndSelectedThread,
      refreshSelectedThreadIncrementalIfPresent,
      refreshPushClientState: pushFeatureComposition.refreshPushClientState,
      ensureFreshPushSettingsDiagnostics: pushFeatureComposition.ensureFreshPushSettingsDiagnostics,
    }),
  );

  useThreadRuntimeStatusHydrationEffect({
    ensureApiSessionBootstrapped: input.runtimeRequestHandlers.ensureApiSessionBootstrapped,
    canHydrateThreadRuntimeStatuses:
      input.applicationDerivedState.activeAgentCapabilities?.canReadLiveState === true ||
      input.applicationDerivedState.activeAgentCapabilities?.canSubmitUserInput === true,
    selectedAgentId: input.applicationShellState.selectedAgentId,
    threads: input.applicationShellState.threads,
    threadServerClient: input.applicationOwnerDependencies.threadServerClient,
    setThreadRuntimeStatusByThreadIdentifier:
      input.applicationShellState.setThreadRuntimeStatusByThreadIdentifier,
    handleRuntimeRequestError: input.runtimeRequestHandlers.handleRuntimeRequestError,
  });

  useSelectedThreadLifecycleEffects(
    buildSelectedThreadLifecycleEffectsInput(runtimeCompositionContext),
  );

  useEventStreamEffects(buildEventStreamEffectsInput(runtimeCompositionContext));

  useModeAndPendingRequestEffects(
    buildModeAndPendingRequestEffectsInput(runtimeCompositionContext),
  );

  const readLastAppliedModeSignature = useCallback((): string => {
    return input.applicationShellState.lastAppliedModeSignatureRef.current;
  }, [input.applicationShellState.lastAppliedModeSignatureRef]);

  const writeLastAppliedModeSignature = useCallback(
    (nextModeSignature: string): void => {
      const lastAppliedModeSignatureRef = input.applicationShellState.lastAppliedModeSignatureRef;
      lastAppliedModeSignatureRef.current = nextModeSignature;
    },
    [input.applicationShellState.lastAppliedModeSignatureRef],
  );

  const invalidateActiveThreadQuery = useCallback((): void => {
    input.applicationOwnerDependencies.threadListStateController.invalidateActiveThreadQuery();
  }, [input.applicationOwnerDependencies.threadListStateController]);

  const chatFeatureComposition = useApplicationChatFeatureComposition(
    buildApplicationChatFeatureCompositionInput(runtimeCompositionContext, {
      readLastAppliedModeSignature,
      writeLastAppliedModeSignature,
      invalidateActiveThreadQuery,
    }),
  );

  const debugFeatureComposition = useApplicationDebugFeatureComposition(
    buildApplicationDebugFeatureCompositionInput(runtimeCompositionContext),
  );

  useApplicationSynchronizationEffects(
    buildApplicationSynchronizationEffectsInput(runtimeCompositionContext, {
      loadHistoryDetail: debugFeatureComposition.loadHistoryDetail,
    }),
  );

  const shellComposition = useApplicationShellComposition(
    buildApplicationShellCompositionInput(runtimeCompositionContext, {
      applyCachedSelectedThreadSnapshot: input.applyCachedSelectedThreadSnapshot,
      refreshCoreDataAndSelectedThread,
      pushFeatureComposition,
      chatFeatureComposition,
      debugFeatureComposition,
    }),
  );

  return {
    shellComposition,
  };
}

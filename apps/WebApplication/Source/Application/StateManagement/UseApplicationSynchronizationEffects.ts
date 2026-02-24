import {
  useEffect,
  type MutableRefObject
} from "react";
import {
  type LoadSelectedThreadOptions
} from "@/Features/Chat/StateManagement/UseSelectedThreadLoaders";

export interface UseApplicationSynchronizationEffectsInput {
  loadCoreDataTracked: () => Promise<void>;
  loadCoreDataTrackedRef: MutableRefObject<(() => Promise<void>) | null>;
  loadSelectedThreadTracked: (threadId: string, options?: LoadSelectedThreadOptions) => Promise<void>;
  loadSelectedThreadRef: MutableRefObject<((threadId: string, options?: LoadSelectedThreadOptions) => Promise<void>) | null>;
  loadHistoryDetail: (historyEntryId: string) => Promise<void>;
  selectedHistoryId: string;
  handleRuntimeRequestError: <ErrorType>(error: ErrorType) => void;
}

export function useApplicationSynchronizationEffects(
  input: UseApplicationSynchronizationEffectsInput
): void {
  useEffect(() => {
    input.loadCoreDataTrackedRef.current = input.loadCoreDataTracked;
  }, [input.loadCoreDataTracked, input.loadCoreDataTrackedRef]);

  useEffect(() => {
    input.loadSelectedThreadRef.current = input.loadSelectedThreadTracked;
  }, [input.loadSelectedThreadTracked, input.loadSelectedThreadRef]);

  useEffect(() => {
    void input.loadHistoryDetail(input.selectedHistoryId).catch((error) => {
      input.handleRuntimeRequestError(error);
    });
  }, [
    input.handleRuntimeRequestError,
    input.loadHistoryDetail,
    input.selectedHistoryId
  ]);
}

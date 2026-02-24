import {
  type DebugActionHandlers,
  type UseDebugActionHandlersInput,
  useDebugActionHandlers
} from "@/Features/Debugging/StateManagement/UseDebugActionHandlers";

export type UseApplicationDebugFeatureCompositionInput = UseDebugActionHandlersInput;

export function useApplicationDebugFeatureComposition(
  input: UseApplicationDebugFeatureCompositionInput
): DebugActionHandlers {
  return useDebugActionHandlers(input);
}

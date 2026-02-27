import {
  type DebugActionHandlers,
  type UseDebugActionHandlersInput,
  useDebugActionHandlers,
} from "@/Features/Debugging/StateManagement/UseDebugActionHandlers";

// Application-level composition intentionally delegates debug action ownership to the
// feature module so debug behavior changes stay isolated behind one feature contract.
export type UseApplicationDebugFeatureCompositionInput = UseDebugActionHandlersInput;

export function useApplicationDebugFeatureComposition(
  input: UseApplicationDebugFeatureCompositionInput,
): DebugActionHandlers {
  return useDebugActionHandlers(input);
}

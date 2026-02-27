import {
  type ApplicationDerivedState,
  type UseApplicationDerivedStateInput,
} from "./UseApplicationDerivedStateContracts";

interface ModeOptionDerivationInput {
  modes: UseApplicationDerivedStateInput["modes"];
  modeSelectionStateResolver: UseApplicationDerivedStateInput["modeSelectionStateResolver"];
}

interface PlanModeEnabledInput {
  planModeOption: ApplicationDerivedState["planModeOption"];
  selectedModeKey: UseApplicationDerivedStateInput["selectedModeKey"];
}

interface EffortOptionDerivationInput {
  defaultEffortOptions: UseApplicationDerivedStateInput["defaultEffortOptions"];
  modes: UseApplicationDerivedStateInput["modes"];
  latestReasoningEffort: string | null | undefined;
  selectedReasoningEffort: UseApplicationDerivedStateInput["selectedReasoningEffort"];
}

interface EffortOptionsWithoutAssumedDefaultInput {
  effortOptions: ApplicationDerivedState["effortOptions"];
  appDefaultReasoningEffort: ApplicationDerivedState["appDefaultReasoningEffort"];
}

interface ModelOptionsWithoutAssumedDefaultInput {
  modelOptions: ApplicationDerivedState["modelOptions"];
  appDefaultModel: ApplicationDerivedState["appDefaultModel"];
}

export function readPlanModeOption(
  input: ModeOptionDerivationInput,
): ApplicationDerivedState["planModeOption"] {
  return (
    input.modes.find((mode) => input.modeSelectionStateResolver.isPlanModeOption(mode)) ?? null
  );
}

export function readDefaultModeOption(
  input: ModeOptionDerivationInput,
): ApplicationDerivedState["defaultModeOption"] {
  return (
    input.modes.find((mode) => !input.modeSelectionStateResolver.isPlanModeOption(mode)) ??
    input.modes[0] ??
    null
  );
}

export function readIsPlanModeEnabled(
  input: PlanModeEnabledInput,
): ApplicationDerivedState["isPlanModeEnabled"] {
  return input.planModeOption !== null && input.selectedModeKey === input.planModeOption.mode;
}

export function readEffortOptions(
  input: EffortOptionDerivationInput,
): ApplicationDerivedState["effortOptions"] {
  const values = new Set<string>(input.defaultEffortOptions);
  for (const mode of input.modes) {
    if (
      mode.reasoning_effort !== null &&
      mode.reasoning_effort !== undefined &&
      mode.reasoning_effort.length > 0
    ) {
      values.add(mode.reasoning_effort);
    }
  }

  if (
    input.latestReasoningEffort !== null &&
    input.latestReasoningEffort !== undefined &&
    input.latestReasoningEffort.length > 0
  ) {
    values.add(input.latestReasoningEffort);
  }

  if (input.selectedReasoningEffort.length > 0) {
    values.add(input.selectedReasoningEffort);
  }

  return Array.from(values);
}

export function readEffortOptionsWithoutAssumedDefault(
  input: EffortOptionsWithoutAssumedDefaultInput,
): ApplicationDerivedState["effortOptionsWithoutAssumedDefault"] {
  return input.effortOptions.filter((option) => option !== input.appDefaultReasoningEffort);
}

export function readModelOptionsWithoutAssumedDefault(
  input: ModelOptionsWithoutAssumedDefaultInput,
): ApplicationDerivedState["modelOptionsWithoutAssumedDefault"] {
  return input.modelOptions.filter((option) => option.id !== input.appDefaultModel);
}

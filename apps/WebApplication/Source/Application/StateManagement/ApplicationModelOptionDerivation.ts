import {
  type ApplicationModelOption,
  type ModelOptionsInput
} from "./UseApplicationDerivedStateContracts";

function readModelOptionLabel(model: ModelOptionsInput["models"][number]): string {
  if (model.displayName && model.displayName !== model.id) {
    return `${model.displayName} (${model.id})`;
  }
  return model.displayName || model.id;
}

export function readModelOptions(input: ModelOptionsInput): ApplicationModelOption[] {
  const { models, latestModel, selectedModelId } = input;
  const modelLabelById = new Map<string, string>();

  for (const model of models) {
    modelLabelById.set(model.id, readModelOptionLabel(model));
  }

  if (latestModel && !modelLabelById.has(latestModel)) {
    modelLabelById.set(latestModel, latestModel);
  }
  if (selectedModelId && !modelLabelById.has(selectedModelId)) {
    modelLabelById.set(selectedModelId, selectedModelId);
  }

  return Array.from(modelLabelById.entries()).map(([id, label]) => ({ id, label }));
}

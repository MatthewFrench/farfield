import type {
  CoreDataCapabilitySnapshot,
  CoreDataConfigDefaultsResponse,
  CoreDataModelsResponse,
  CoreDataModesResponse,
} from "./CoreDataSnapshotContracts";

type ConfigDefaults = CoreDataConfigDefaultsResponse;
type ModesResponse = CoreDataModesResponse;
type ModelsResponse = CoreDataModelsResponse;
type ModeDescriptor = ModesResponse["data"][number];
type ModelDescriptor = ModelsResponse["data"][number];
type SignatureSegment = string | null | undefined;
type ModeSignatureSegments = readonly [
  modeIdentifier: ModeDescriptor["mode"],
  modeName: ModeDescriptor["name"],
  modeReasoningEffort: ModeDescriptor["reasoning_effort"],
];
type ModelSignatureSegments = readonly [
  modelIdentifier: ModelDescriptor["id"],
  modelDisplayName: ModelDescriptor["displayName"],
];

const SIGNATURE_SEGMENT_DELIMITER = "|";
const EMPTY_SIGNATURE_SEGMENT = "";

/**
 * Owns capability snapshot signature derivation so mode/model write rules remain
 * deterministic across startup hydration and refresh updates.
 */
export interface CapabilitiesCollectionSnapshot {
  modes: ModesResponse["data"];
  models: ModelsResponse["data"];
  defaults: ConfigDefaults | null;
  modesSignature: string[];
  modelsSignature: string[];
}

function buildSignatureEntry(segments: ReadonlyArray<SignatureSegment>): string {
  return segments
    .map((segment) => segment ?? EMPTY_SIGNATURE_SEGMENT)
    .join(SIGNATURE_SEGMENT_DELIMITER);
}

function readModeSignatureSegments(mode: ModeDescriptor): ModeSignatureSegments {
  return [mode.mode, mode.name, mode.reasoning_effort];
}

function readModelSignatureSegments(model: ModelDescriptor): ModelSignatureSegments {
  return [model.id, model.displayName];
}

function buildModesSignature(modes: ModesResponse["data"]): string[] {
  return modes.map((mode) => buildSignatureEntry(readModeSignatureSegments(mode)));
}

function buildModelsSignature(models: ModelsResponse["data"]): string[] {
  return models.map((model) => buildSignatureEntry(readModelSignatureSegments(model)));
}

export function readCapabilitiesCollectionSnapshot(
  capabilities: CoreDataCapabilitySnapshot | undefined,
): CapabilitiesCollectionSnapshot | null {
  if (!capabilities) {
    return null;
  }

  const nextModes = capabilities.modes.data;
  const nextModels = capabilities.models.data;
  return {
    modes: nextModes,
    models: nextModels,
    defaults: capabilities.defaults,
    modesSignature: buildModesSignature(nextModes),
    modelsSignature: buildModelsSignature(nextModels),
  };
}

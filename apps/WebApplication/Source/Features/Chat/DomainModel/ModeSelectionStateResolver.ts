import type { AppServerCollaborationModeListResponse, ThreadConversationState } from "@farfield/protocol";

export interface ModeSelectionState {
  modeKey: string;
  modelId: string;
  reasoningEffort: string;
}

export type CollaborationModeOption = AppServerCollaborationModeListResponse["data"][number];
export type ModeSelectionConversationState = Pick<
  ThreadConversationState,
  "latestCollaborationMode" | "latestModel" | "latestReasoningEffort"
>;

export class ModeSelectionStateResolver {
  public isPlanModeOption(mode: CollaborationModeOption): boolean {
    const modeKey = (mode.mode ?? "").toLowerCase();
    return modeKey.includes("plan") || mode.name.toLowerCase().includes("plan");
  }

  public buildModeSignature(modeKey: string, modelId: string, effort: string): string {
    return `${modeKey}|${modelId}|${effort}`;
  }

  public readModeSelectionFromConversationState(
    state: ModeSelectionConversationState | null,
    appDefaultModel: string,
    appDefaultEffort: string
  ): ModeSelectionState {
    if (!state) {
      return this.readEmptyModeSelectionState();
    }

    if (state.latestCollaborationMode) {
      return {
        modeKey: state.latestCollaborationMode.mode,
        modelId: this.normalizeModeSettingValue(
          state.latestCollaborationMode.settings.model,
          appDefaultModel
        ),
        reasoningEffort: this.normalizeModeSettingValue(
          state.latestCollaborationMode.settings.reasoning_effort,
          appDefaultEffort
        )
      };
    }

    return {
      modeKey: "",
      modelId: this.normalizeModeSettingValue(state.latestModel, appDefaultModel),
      reasoningEffort: this.normalizeModeSettingValue(state.latestReasoningEffort, appDefaultEffort)
    };
  }

  public readModeSelectionSignatureFromConversationState(
    state: ModeSelectionConversationState | null | undefined,
    appDefaultModel: string,
    appDefaultEffort: string
  ): string {
    const selection = this.readModeSelectionFromConversationState(
      state ?? null,
      appDefaultModel,
      appDefaultEffort
    );
    return this.buildModeSignature(selection.modeKey, selection.modelId, selection.reasoningEffort);
  }

  private readEmptyModeSelectionState(): ModeSelectionState {
    return {
      modeKey: "",
      modelId: "",
      reasoningEffort: ""
    };
  }

  private normalizeNullableModeValue(value: string | null | undefined): string {
    if (value === null || value === undefined) {
      return "";
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : "";
  }

  private normalizeModeSettingValue(
    value: string | null | undefined,
    assumedDefault: string
  ): string {
    const normalized = this.normalizeNullableModeValue(value);
    if (!normalized) {
      return "";
    }
    if (normalized === assumedDefault) {
      return "";
    }
    return normalized;
  }
}

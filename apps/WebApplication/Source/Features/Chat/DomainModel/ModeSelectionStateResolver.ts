export interface ModeSelectionState {
  modeKey: string;
  modelId: string;
  reasoningEffort: string;
}

export interface CollaborationModeOption {
  mode?: string | null | undefined;
  name: string;
}

export interface ModeSelectionConversationState {
  latestCollaborationMode?: {
    mode: string;
    settings: {
      model?: string | null | undefined;
      reasoning_effort?: string | null | undefined;
      developer_instructions?: string | null | undefined;
    };
  } | null | undefined;
  latestModel?: string | null | undefined;
  latestReasoningEffort?: string | null | undefined;
}

export class ModeSelectionStateResolver {
  public isPlanModeOption(mode: CollaborationModeOption): boolean {
    const modeKey = typeof mode.mode === "string" ? mode.mode : "";
    return modeKey.toLowerCase().includes("plan") || mode.name.toLowerCase().includes("plan");
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
      return {
        modeKey: "",
        modelId: "",
        reasoningEffort: ""
      };
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

  private normalizeNullableModeValue(value: string | null | undefined): string {
    if (typeof value !== "string") {
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

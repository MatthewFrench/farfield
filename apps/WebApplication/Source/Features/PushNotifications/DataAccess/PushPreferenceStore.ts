import { z } from "zod";

const PushAutoHealPreferenceSchema = z.enum(["true", "false"]);
const PushAutoHealEnabledSchema = z.boolean();

export class PushPreferenceStore {
  private readonly autoHealPreferenceStorageKey: string;

  public constructor(autoHealPreferenceStorageKey = "farfield.push.auto-heal-enabled.v1") {
    this.autoHealPreferenceStorageKey = autoHealPreferenceStorageKey;
  }

  public readAutoHealPreferenceEnabled(): boolean {
    const rawAutoHealPreference = window.localStorage.getItem(
      this.autoHealPreferenceStorageKey
    );
    if (rawAutoHealPreference === null) {
      return false;
    }
    const parsedAutoHealPreference = PushAutoHealPreferenceSchema.safeParse(rawAutoHealPreference);
    if (!parsedAutoHealPreference.success) {
      throw new Error(
        `Push auto-heal preference at key "${this.autoHealPreferenceStorageKey}" is invalid. Expected "true" or "false".`
      );
    }
    return parsedAutoHealPreference.data === "true";
  }

  public writeAutoHealPreferenceEnabled(enabled: boolean): void {
    const parsedEnabled = PushAutoHealEnabledSchema.parse(enabled);
    window.localStorage.setItem(
      this.autoHealPreferenceStorageKey,
      parsedEnabled ? "true" : "false"
    );
  }
}

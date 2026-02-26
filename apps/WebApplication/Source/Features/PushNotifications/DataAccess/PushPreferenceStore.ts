import { z } from "zod";

const PUSH_AUTO_HEAL_ENABLED_STORAGE_VALUE = "true";
const PUSH_AUTO_HEAL_DISABLED_STORAGE_VALUE = "false";

const PushAutoHealPreferenceSchema = z.enum([
  PUSH_AUTO_HEAL_ENABLED_STORAGE_VALUE,
  PUSH_AUTO_HEAL_DISABLED_STORAGE_VALUE
]);
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
        `Push auto-heal preference at key "${this.autoHealPreferenceStorageKey}" is invalid. Expected "${PUSH_AUTO_HEAL_ENABLED_STORAGE_VALUE}" or "${PUSH_AUTO_HEAL_DISABLED_STORAGE_VALUE}".`
      );
    }
    return parsedAutoHealPreference.data === PUSH_AUTO_HEAL_ENABLED_STORAGE_VALUE;
  }

  public writeAutoHealPreferenceEnabled(enabled: boolean): void {
    const parsedEnabled = PushAutoHealEnabledSchema.parse(enabled);
    window.localStorage.setItem(
      this.autoHealPreferenceStorageKey,
      parsedEnabled
        ? PUSH_AUTO_HEAL_ENABLED_STORAGE_VALUE
        : PUSH_AUTO_HEAL_DISABLED_STORAGE_VALUE
    );
  }
}

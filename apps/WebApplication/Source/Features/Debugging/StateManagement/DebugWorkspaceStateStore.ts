import type { DebugWorkspaceDataSnapshot } from "./DebugWorkspaceDataReader";

type DebugHistoryEntries = DebugWorkspaceDataSnapshot["history"];

export class DebugWorkspaceStateStore {
  public readNextHistory(
    previousHistory: DebugHistoryEntries,
    nextHistory: DebugHistoryEntries
  ): DebugHistoryEntries {
    if (
      previousHistory.length === nextHistory.length
      && previousHistory[previousHistory.length - 1]?.id === nextHistory[nextHistory.length - 1]?.id
    ) {
      return previousHistory;
    }
    return nextHistory;
  }

  public shouldApplyDebugErrors(
    previousSignature: readonly string[],
    nextSignature: readonly string[]
  ): boolean {
    return !this.readSignaturesMatch(previousSignature, nextSignature);
  }

  private readSignaturesMatch(
    firstSignature: readonly string[],
    secondSignature: readonly string[]
  ): boolean {
    if (firstSignature.length !== secondSignature.length) {
      return false;
    }
    for (let index = 0; index < firstSignature.length; index += 1) {
      if (firstSignature[index] !== secondSignature[index]) {
        return false;
      }
    }
    return true;
  }
}

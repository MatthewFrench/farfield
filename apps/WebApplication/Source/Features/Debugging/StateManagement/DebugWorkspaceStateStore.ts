import type { DebugWorkspaceDataSnapshot } from "./DebugWorkspaceDataReader";

type DebugHistoryEntries = DebugWorkspaceDataSnapshot["history"];
const FIRST_COLLECTION_INDEX = 0;

export class DebugWorkspaceStateStore {
  public readNextHistory(
    previousHistory: DebugHistoryEntries,
    nextHistory: DebugHistoryEntries,
  ): DebugHistoryEntries {
    if (this.readHistoryCollectionIdentifiersMatch(previousHistory, nextHistory)) {
      return previousHistory;
    }
    return nextHistory;
  }

  public shouldApplyDebugErrors(
    previousSignature: readonly string[],
    nextSignature: readonly string[],
  ): boolean {
    return !this.readSignaturesMatch(previousSignature, nextSignature);
  }

  private readHistoryCollectionIdentifiersMatch(
    previousHistory: DebugHistoryEntries,
    nextHistory: DebugHistoryEntries,
  ): boolean {
    if (previousHistory.length !== nextHistory.length) {
      return false;
    }

    if (previousHistory.length === 0) {
      return true;
    }

    const previousFirstHistoryEntryIdentifier = previousHistory[FIRST_COLLECTION_INDEX]?.id ?? null;
    const nextFirstHistoryEntryIdentifier = nextHistory[FIRST_COLLECTION_INDEX]?.id ?? null;
    const previousLastHistoryEntryIdentifier =
      previousHistory[previousHistory.length - 1]?.id ?? null;
    const nextLastHistoryEntryIdentifier = nextHistory[nextHistory.length - 1]?.id ?? null;
    if (
      previousFirstHistoryEntryIdentifier === null ||
      nextFirstHistoryEntryIdentifier === null ||
      previousLastHistoryEntryIdentifier === null ||
      nextLastHistoryEntryIdentifier === null
    ) {
      return false;
    }

    return (
      previousFirstHistoryEntryIdentifier === nextFirstHistoryEntryIdentifier &&
      previousLastHistoryEntryIdentifier === nextLastHistoryEntryIdentifier
    );
  }

  private readSignaturesMatch(
    firstSignature: readonly string[],
    secondSignature: readonly string[],
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

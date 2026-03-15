import { ThreadGroupSelectors } from "../DomainModel/ThreadGroupSelectors";
import type { ThreadListItem } from "../DomainModel/ThreadGroupTypes";

const THREAD_SIGNATURE_SEGMENT_DELIMITER = "|";
const THREAD_SIGNATURE_EMPTY_PATH_SEGMENT = "";
const INITIAL_SELECTION_NOT_HYDRATED = false;

type UnreadThreadIdentifierMap = Record<string, true>;
type ThreadUpdatedAtByIdentifier = Record<string, number>;
type ThreadSignature = string[];

export interface ActiveThreadStateComputationInput {
  nextThreads: ThreadListItem[];
  previousUnreadThreadIdentifiers: UnreadThreadIdentifierMap;
  selectedThreadIdentifier: string | null;
}

export interface ActiveThreadStateComputationResult {
  didChangeThreads: boolean;
  nextThreads: ThreadListItem[];
  nextUnreadThreadIdentifiers: UnreadThreadIdentifierMap;
}

export interface ArchivedThreadStateComputationInput {
  nextArchivedThreads: ThreadListItem[];
}

export interface ArchivedThreadStateComputationResult {
  didChangeArchivedThreads: boolean;
  nextArchivedThreads: ThreadListItem[];
}

export interface InitialThreadSelectionComputationInput {
  currentSelectedThreadIdentifier: string | null;
  preferredAgentIdentifier: ThreadListItem["agentId"] | null;
  nextThreads: ThreadListItem[];
}

export interface UnreadThreadSelectionUpdateInput {
  previousUnreadThreadIdentifiers: UnreadThreadIdentifierMap;
  selectedThreadIdentifier: string | null;
}

/**
 * Owns thread-list signature and unread-state transitions.
 * This owner keeps a compact previous-thread snapshot so list refreshes can detect changes
 * and unread markers without re-reading cross-feature state.
 */
export class ThreadListStateStore {
  private activeThreadSignature: ThreadSignature = [];
  private archivedThreadSignature: ThreadSignature = [];
  private threadUpdatedAtByIdentifier: ThreadUpdatedAtByIdentifier = {};
  // Guards first-load auto-selection so user-driven selection is not overwritten on later refreshes.
  private hasHydratedInitialThreadSelection: boolean = INITIAL_SELECTION_NOT_HYDRATED;

  public constructor() {
    this.resetTrackedState();
  }

  public computeActiveThreadState(
    input: ActiveThreadStateComputationInput,
  ): ActiveThreadStateComputationResult {
    const nextThreadSignature = this.buildThreadSignature(input.nextThreads);
    const didChangeThreads = !ThreadGroupSelectors.signaturesMatch(
      this.activeThreadSignature,
      nextThreadSignature,
    );
    const nextThreadUpdatedAtByIdentifier = ThreadGroupSelectors.mapThreadUpdatedAtByIdentifier(
      input.nextThreads,
    );
    const nextUnreadThreadIdentifiers = ThreadGroupSelectors.computeUnreadThreadIdentifiers({
      previousUnreadThreadIdentifiers: input.previousUnreadThreadIdentifiers,
      previousThreadUpdatedAtByIdentifier: this.threadUpdatedAtByIdentifier,
      nextThreads: input.nextThreads,
      selectedThreadIdentifier: input.selectedThreadIdentifier,
    });

    this.activeThreadSignature = nextThreadSignature;
    this.threadUpdatedAtByIdentifier = nextThreadUpdatedAtByIdentifier;

    return {
      didChangeThreads,
      nextThreads: input.nextThreads,
      nextUnreadThreadIdentifiers,
    };
  }

  public computeArchivedThreadState(
    input: ArchivedThreadStateComputationInput,
  ): ArchivedThreadStateComputationResult {
    const nextArchivedThreadSignature = this.buildThreadSignature(input.nextArchivedThreads);
    const didChangeArchivedThreads = !ThreadGroupSelectors.signaturesMatch(
      this.archivedThreadSignature,
      nextArchivedThreadSignature,
    );
    this.archivedThreadSignature = nextArchivedThreadSignature;

    return {
      didChangeArchivedThreads,
      nextArchivedThreads: input.nextArchivedThreads,
    };
  }

  public resetState(): void {
    this.resetTrackedState();
  }

  public computeInitialSelectedThreadIdentifier(
    input: InitialThreadSelectionComputationInput,
  ): string | null {
    const currentSelectedThreadIdentifier = input.currentSelectedThreadIdentifier;
    if (currentSelectedThreadIdentifier !== null && currentSelectedThreadIdentifier.length > 0) {
      this.markInitialSelectionHydrated();
      return currentSelectedThreadIdentifier;
    }
    if (this.hasHydratedInitialThreadSelection) {
      return currentSelectedThreadIdentifier;
    }

    const nextSelectedThreadIdentifier = this.readInitialSelectedThreadIdentifier(input);
    if (nextSelectedThreadIdentifier !== null && nextSelectedThreadIdentifier.length > 0) {
      this.markInitialSelectionHydrated();
    }
    return nextSelectedThreadIdentifier;
  }

  public computeUnreadThreadIdentifiersAfterSelectionChange(
    input: UnreadThreadSelectionUpdateInput,
  ): UnreadThreadIdentifierMap {
    if (input.selectedThreadIdentifier === null || input.selectedThreadIdentifier.length === 0) {
      return input.previousUnreadThreadIdentifiers;
    }
    if (input.previousUnreadThreadIdentifiers[input.selectedThreadIdentifier] !== true) {
      return input.previousUnreadThreadIdentifiers;
    }

    const nextUnreadThreadIdentifiers = {
      ...input.previousUnreadThreadIdentifiers,
    };
    delete nextUnreadThreadIdentifiers[input.selectedThreadIdentifier];
    return nextUnreadThreadIdentifiers;
  }

  private resetTrackedState(): void {
    this.activeThreadSignature = [];
    this.archivedThreadSignature = [];
    this.threadUpdatedAtByIdentifier = {};
    this.hasHydratedInitialThreadSelection = INITIAL_SELECTION_NOT_HYDRATED;
  }

  private markInitialSelectionHydrated(): void {
    this.hasHydratedInitialThreadSelection = true;
  }

  private readInitialSelectedThreadIdentifier(
    input: InitialThreadSelectionComputationInput,
  ): string | null {
    if (input.preferredAgentIdentifier !== null && input.preferredAgentIdentifier.length > 0) {
      const preferredThread = input.nextThreads.find(
        (thread) => thread.agentId === input.preferredAgentIdentifier,
      );
      if (preferredThread) {
        return preferredThread.id;
      }
    }
    return input.nextThreads[0]?.id ?? null;
  }

  private buildThreadSignature(threads: ThreadListItem[]): ThreadSignature {
    return threads.map((thread) => this.buildThreadSignatureValue(thread));
  }

  private buildThreadSignatureValue(thread: ThreadListItem): string {
    // Signature ordering is append-only so state change detection remains deterministic.
    return [
      thread.id,
      String(thread.updatedAt),
      thread.displayName ?? THREAD_SIGNATURE_EMPTY_PATH_SEGMENT,
      thread.lastUserMessage ?? THREAD_SIGNATURE_EMPTY_PATH_SEGMENT,
      thread.preview,
      thread.agentId,
      thread.cwd ?? THREAD_SIGNATURE_EMPTY_PATH_SEGMENT,
      thread.path ?? THREAD_SIGNATURE_EMPTY_PATH_SEGMENT,
      String(thread.hasUnreadTurn ?? null),
      String(thread.latestActivityIsUserMessage ?? false),
      String(thread.isLoadedInMemory ?? false),
    ].join(THREAD_SIGNATURE_SEGMENT_DELIMITER);
  }
}

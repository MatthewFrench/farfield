import { ThreadGroupSelectors } from "../DomainModel/ThreadGroupSelectors";
import type { ThreadListItem } from "../DomainModel/ThreadGroupTypes";

const THREAD_SIGNATURE_DELIMITER = "|";
const EMPTY_THREAD_PATH_SIGNATURE_VALUE = "";
const DEFAULT_UPDATED_AT_SIGNATURE_VALUE = 0;

export interface ActiveThreadStateComputationInput {
  nextThreads: ThreadListItem[];
  previousUnreadThreadIdentifiers: Record<string, true>;
  selectedThreadIdentifier: string | null;
}

export interface ActiveThreadStateComputationResult {
  didChangeThreads: boolean;
  nextThreads: ThreadListItem[];
  nextUnreadThreadIdentifiers: Record<string, true>;
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
  previousUnreadThreadIdentifiers: Record<string, true>;
  selectedThreadIdentifier: string | null;
}

/**
 * Owns thread-list signature and unread-state transitions.
 * This owner keeps a compact previous-thread snapshot so list refreshes can detect changes
 * and unread markers without re-reading cross-feature state.
 */
export class ThreadListStateStore {
  private activeThreadSignature: string[];
  private archivedThreadSignature: string[];
  private threadUpdatedAtByIdentifier: Record<string, number>;
  // Guards first-load auto-selection so user-driven selection is not overwritten on later refreshes.
  private hasHydratedInitialThreadSelection: boolean;

  public constructor() {
    this.activeThreadSignature = [];
    this.archivedThreadSignature = [];
    this.threadUpdatedAtByIdentifier = {};
    this.hasHydratedInitialThreadSelection = false;
  }

  public computeActiveThreadState(
    input: ActiveThreadStateComputationInput
  ): ActiveThreadStateComputationResult {
    const nextThreadSignature = this.buildThreadSignature(input.nextThreads);
    const didChangeThreads = !ThreadGroupSelectors.signaturesMatch(this.activeThreadSignature, nextThreadSignature);
    const nextThreadUpdatedAtByIdentifier = ThreadGroupSelectors.mapThreadUpdatedAtByIdentifier(input.nextThreads);
    const nextUnreadThreadIdentifiers = ThreadGroupSelectors.computeUnreadThreadIdentifiers({
      previousUnreadThreadIdentifiers: input.previousUnreadThreadIdentifiers,
      previousThreadUpdatedAtByIdentifier: this.threadUpdatedAtByIdentifier,
      nextThreads: input.nextThreads,
      selectedThreadIdentifier: input.selectedThreadIdentifier
    });

    this.activeThreadSignature = nextThreadSignature;
    this.threadUpdatedAtByIdentifier = nextThreadUpdatedAtByIdentifier;

    return {
      didChangeThreads,
      nextThreads: input.nextThreads,
      nextUnreadThreadIdentifiers
    };
  }

  public computeArchivedThreadState(
    input: ArchivedThreadStateComputationInput
  ): ArchivedThreadStateComputationResult {
    const nextArchivedThreadSignature = this.buildThreadSignature(input.nextArchivedThreads);
    const didChangeArchivedThreads = !ThreadGroupSelectors.signaturesMatch(
      this.archivedThreadSignature,
      nextArchivedThreadSignature
    );
    this.archivedThreadSignature = nextArchivedThreadSignature;

    return {
      didChangeArchivedThreads,
      nextArchivedThreads: input.nextArchivedThreads
    };
  }

  public resetState(): void {
    this.activeThreadSignature = [];
    this.archivedThreadSignature = [];
    this.threadUpdatedAtByIdentifier = {};
    this.hasHydratedInitialThreadSelection = false;
  }

  public computeInitialSelectedThreadIdentifier(input: InitialThreadSelectionComputationInput): string | null {
    if (input.currentSelectedThreadIdentifier) {
      this.hasHydratedInitialThreadSelection = true;
      return input.currentSelectedThreadIdentifier;
    }
    if (this.hasHydratedInitialThreadSelection) {
      return input.currentSelectedThreadIdentifier;
    }

    let nextSelectedThreadIdentifier: string | null = null;
    if (input.preferredAgentIdentifier) {
      const preferredThread = input.nextThreads.find(
        (thread) => thread.agentId === input.preferredAgentIdentifier
      );
      if (preferredThread) {
        nextSelectedThreadIdentifier = preferredThread.id;
      }
    }
    if (!nextSelectedThreadIdentifier) {
      nextSelectedThreadIdentifier = input.nextThreads[0]?.id ?? null;
    }
    if (nextSelectedThreadIdentifier) {
      this.hasHydratedInitialThreadSelection = true;
    }
    return nextSelectedThreadIdentifier;
  }

  public computeUnreadThreadIdentifiersAfterSelectionChange(
    input: UnreadThreadSelectionUpdateInput
  ): Record<string, true> {
    if (!input.selectedThreadIdentifier) {
      return input.previousUnreadThreadIdentifiers;
    }
    if (input.previousUnreadThreadIdentifiers[input.selectedThreadIdentifier] !== true) {
      return input.previousUnreadThreadIdentifiers;
    }

    const nextUnreadThreadIdentifiers = { ...input.previousUnreadThreadIdentifiers };
    delete nextUnreadThreadIdentifiers[input.selectedThreadIdentifier];
    return nextUnreadThreadIdentifiers;
  }

  private buildThreadSignature(threads: ThreadListItem[]): string[] {
    return threads.map((thread) => this.buildThreadSignatureValue(thread));
  }

  private buildThreadSignatureValue(thread: ThreadListItem): string {
    return [
      thread.id,
      String(thread.updatedAt ?? DEFAULT_UPDATED_AT_SIGNATURE_VALUE),
      thread.preview,
      thread.agentId,
      thread.cwd ?? EMPTY_THREAD_PATH_SIGNATURE_VALUE,
      thread.path ?? EMPTY_THREAD_PATH_SIGNATURE_VALUE
    ].join(THREAD_SIGNATURE_DELIMITER);
  }
}

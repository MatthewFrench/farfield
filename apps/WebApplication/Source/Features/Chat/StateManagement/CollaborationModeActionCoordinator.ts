import type { ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import { toErrorMessage } from "@/SharedUtilities/DebugHelpers";
import { ModeSelectionStateResolver } from "../DomainModel/ModeSelectionStateResolver";

export interface CollaborationModeActionRequestOptions {
  actionId: string;
  requestOptions: ApiRequestOptions;
}

export interface CollaborationModeActionErrorReportInput {
  operation: string;
  actionId: string;
  threadId: string | null;
  error: Error | string | number | boolean | bigint | symbol | null | undefined | object;
  details?: Record<string, string | number | boolean | null>;
}

export interface CollaborationModeActionModeOption {
  mode?: string | null | undefined;
  developer_instructions?: string | null | undefined;
}

export interface CollaborationModeActionDraft {
  modeKey: string;
  modelId: string;
  reasoningEffort: string;
}

export interface CollaborationModeActionChatClient {
  setCollaborationMode(
    input: {
      threadId: string;
      collaborationMode: {
        mode: string;
        settings: {
          model: string | null;
          reasoning_effort: string | null;
          developer_instructions: string | null;
        };
      };
    },
    options?: ApiRequestOptions
  ): Promise<void>;
}

export interface ApplyCollaborationModeDraftActionInput {
  draft: CollaborationModeActionDraft;
  selectedThreadId: string | null;
  modes: CollaborationModeActionModeOption[];
  isModeSyncing: boolean;
  readLastAppliedModeSignature: () => string;
  writeLastAppliedModeSignature: (nextModeSignature: string) => void;
  buildActionRequestOptions: (actionName: string) => CollaborationModeActionRequestOptions;
  onSetModeSyncing: (isModeSyncing: boolean) => void;
  chatClient: CollaborationModeActionChatClient;
  onReloadSelectedThread: (threadId: string) => Promise<void>;
  reportTrackedUserInterfaceError: (input: CollaborationModeActionErrorReportInput) => Promise<void>;
}

export class CollaborationModeActionCoordinator {
  private readonly modeSelectionStateResolver: ModeSelectionStateResolver;

  public constructor(modeSelectionStateResolver: ModeSelectionStateResolver) {
    this.modeSelectionStateResolver = modeSelectionStateResolver;
  }

  public async applyDraft(input: ApplyCollaborationModeDraftActionInput): Promise<void> {
    if (!input.selectedThreadId) {
      return;
    }

    const mode = input.modes.find((entry) => entry.mode === input.draft.modeKey) ?? null;
    if (!mode || mode.mode !== input.draft.modeKey) {
      return;
    }

    const modeSignature = this.modeSelectionStateResolver.buildModeSignature(
      input.draft.modeKey,
      input.draft.modelId,
      input.draft.reasoningEffort
    );
    const lastAppliedModeSignature = input.readLastAppliedModeSignature();
    if (!input.isModeSyncing && lastAppliedModeSignature === modeSignature) {
      return;
    }

    const { actionId, requestOptions } = input.buildActionRequestOptions("set-collaboration-mode");
    input.writeLastAppliedModeSignature(modeSignature);
    input.onSetModeSyncing(true);
    try {
      await input.chatClient.setCollaborationMode({
        threadId: input.selectedThreadId,
        collaborationMode: {
          mode: mode.mode,
          settings: {
            model: input.draft.modelId || null,
            reasoning_effort: input.draft.reasoningEffort || null,
            developer_instructions: mode.developer_instructions ?? null
          }
        }
      }, requestOptions);
      await input.onReloadSelectedThread(input.selectedThreadId);
    } catch (error) {
      input.writeLastAppliedModeSignature(lastAppliedModeSignature);
      await input.reportTrackedUserInterfaceError({
        operation: "set-collaboration-mode",
        actionId,
        threadId: input.selectedThreadId,
        error: toErrorMessage(error),
        details: {
          modeKey: input.draft.modeKey
        }
      });
    } finally {
      input.onSetModeSyncing(false);
    }
  }
}

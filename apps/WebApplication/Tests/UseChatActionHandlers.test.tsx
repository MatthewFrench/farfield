import { ChatGptAuthTokensRefreshRequestMethod } from "@farfield/protocol";
import { cleanup, render, waitFor } from "@testing-library/react";
import { type MutableRefObject, useEffect, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModeSelectionStateResolver } from "@/Features/Chat/DomainModel/ModeSelectionStateResolver";
import { type PendingApplyPatchApprovalRequest } from "@/Features/Chat/DomainModel/PendingApplyPatchApprovalRequestSelector";
import { type PendingAuthTokenRefreshRequest } from "@/Features/Chat/DomainModel/PendingAuthTokenRefreshRequestSelector";
import { type PendingExecuteCommandApprovalRequest } from "@/Features/Chat/DomainModel/PendingExecuteCommandApprovalRequestSelector";
import {
  PendingUserInputAnswerBuilder,
  type PendingUserInputAnswerDraftByQuestionId,
} from "@/Features/Chat/DomainModel/PendingUserInputAnswerBuilder";
import { type PendingUserInputRequest } from "@/Features/Chat/DomainModel/PendingUserInputRequestSelector";
import {
  type ChatRequestActionChatClient,
  ChatRequestActionCoordinator,
  type ChatRequestActionThreadMutationClient,
} from "@/Features/Chat/StateManagement/ChatRequestActionCoordinator";
import {
  type CollaborationModeActionChatClient,
  CollaborationModeActionCoordinator,
  type CollaborationModeActionModeOption,
} from "@/Features/Chat/StateManagement/CollaborationModeActionCoordinator";
import {
  type ChatActionHandlers,
  type UseChatActionHandlersInput,
  useChatActionHandlers,
} from "@/Features/Chat/StateManagement/UseChatActionHandlers";
import { PendingThreadMaterializationCoordinator } from "@/Features/Threads/StateManagement/PendingThreadMaterializationCoordinator";

interface HandlerHarnessProps {
  input: UseChatActionHandlersInput;
  onHandlersReady: (handlers: ChatActionHandlers) => void;
}

interface StatefulAnswerHarnessProps {
  input: UseChatActionHandlersInput;
  initialAnswerDraft: PendingUserInputAnswerDraftByQuestionId;
  onStateChanged: (
    handlers: ChatActionHandlers,
    answerDraft: PendingUserInputAnswerDraftByQuestionId,
  ) => void;
}

interface TestInputOverrides {
  selectedThreadId?: string | null;
  activeRequest?: PendingUserInputRequest | null;
  activeAuthTokenRefreshRequest?: PendingAuthTokenRefreshRequest | null;
  activeApplyPatchApprovalRequest?: PendingApplyPatchApprovalRequest | null;
  activeExecuteCommandApprovalRequest?: PendingExecuteCommandApprovalRequest | null;
  answerDraft?: PendingUserInputAnswerDraftByQuestionId;
  modes?: CollaborationModeActionModeOption[];
  isModeSyncing?: boolean;
}

type NullableThreadIdentifierSetterValue =
  | string
  | null
  | ((previousValue: string | null) => string | null);
type BooleanSetterValue = boolean | ((previousValue: boolean) => boolean);
type AnswerDraftSetterValue =
  | PendingUserInputAnswerDraftByQuestionId
  | ((
      previousValue: PendingUserInputAnswerDraftByQuestionId,
    ) => PendingUserInputAnswerDraftByQuestionId);
type ChatActionHandlersChatClient = ChatRequestActionChatClient & CollaborationModeActionChatClient;

const DEFAULT_AGENT_IDENTIFIER = "codex";
const DEFAULT_THREAD_IDENTIFIER = "thread-1";
const CREATED_THREAD_IDENTIFIER = "thread-created";
const DEFAULT_MODES: CollaborationModeActionModeOption[] = [
  {
    mode: "default",
    developer_instructions: "Use explicit reasoning.",
  },
];

function HandlerHarness({ input, onHandlersReady }: HandlerHarnessProps): React.JSX.Element {
  const handlers = useChatActionHandlers(input);

  useEffect(() => {
    onHandlersReady(handlers);
  }, [handlers, onHandlersReady]);

  return <></>;
}

function StatefulAnswerHarness({
  input,
  initialAnswerDraft,
  onStateChanged,
}: StatefulAnswerHarnessProps): React.JSX.Element {
  const [answerDraft, setAnswerDraft] =
    useState<PendingUserInputAnswerDraftByQuestionId>(initialAnswerDraft);
  const handlers = useChatActionHandlers({
    ...input,
    answerDraft,
    setAnswerDraft,
  });

  useEffect(() => {
    onStateChanged(handlers, answerDraft);
  }, [answerDraft, handlers, onStateChanged]);

  return <></>;
}

function buildActionRequestOptions(actionName: string) {
  return {
    actionId: `action-${actionName}`,
    requestOptions: {
      actionId: `action-${actionName}`,
      actionName,
    },
  };
}

function buildPendingUserInputRequest(): PendingUserInputRequest {
  return {
    method: "item/tool/requestUserInput",
    id: 42,
    params: {
      threadId: DEFAULT_THREAD_IDENTIFIER,
      turnId: "turn-1",
      itemId: "item-1",
      questions: [
        {
          id: "question-1",
          header: "Question",
          question: "Pick one",
          isOther: false,
          isSecret: false,
          options: [
            {
              label: "Alpha",
              description: "First option",
            },
          ],
        },
      ],
    },
    completed: false,
  };
}

function buildPendingAuthTokenRefreshRequest(): PendingAuthTokenRefreshRequest {
  return {
    method: ChatGptAuthTokensRefreshRequestMethod,
    id: 72,
    completed: false,
    params: {
      reason: "unauthorized",
      previousAccountId: "account-existing",
    },
  };
}

function buildPendingApplyPatchApprovalRequest(): PendingApplyPatchApprovalRequest {
  return {
    method: "applyPatchApproval",
    id: 73,
    completed: false,
    params: {
      callId: "call-73",
      changes: "*** Begin Patch\n*** End Patch",
    },
  };
}

function buildPendingExecuteCommandApprovalRequest(): PendingExecuteCommandApprovalRequest {
  return {
    method: "execCommandApproval",
    id: 74,
    completed: false,
    params: {
      callId: "call-74",
      command: ["git", "status"],
      cwd: "/workspace",
    },
  };
}

function createChatClient(): ChatActionHandlersChatClient {
  return {
    sendMessage: vi.fn(async () => {}),
    submitUserInput: vi.fn(async () => {}),
    interruptThread: vi.fn(async () => {}),
    setCollaborationMode: vi.fn(async () => {}),
  };
}

function createThreadMutationClient(): ChatRequestActionThreadMutationClient {
  return {
    createThread: vi.fn(async () => ({
      threadId: CREATED_THREAD_IDENTIFIER,
    })),
  };
}

function createTestInput(overrides: TestInputOverrides = {}) {
  const chatRequestActionCoordinator = new ChatRequestActionCoordinator();
  const collaborationModeActionCoordinator = new CollaborationModeActionCoordinator(
    new ModeSelectionStateResolver(),
  );
  const pendingThreadMaterializationCoordinator = new PendingThreadMaterializationCoordinator();
  const pendingUserInputAnswerBuilder = new PendingUserInputAnswerBuilder();
  const setAnswerDraft = vi.fn<(value: AnswerDraftSetterValue) => void>();
  const setIsBusy = vi.fn<(value: BooleanSetterValue) => void>();
  const setIsModeSyncing = vi.fn<(value: BooleanSetterValue) => void>();
  const setSelectedThreadId = vi.fn<(value: NullableThreadIdentifierSetterValue) => void>();
  const selectedThreadId =
    overrides.selectedThreadId === undefined
      ? DEFAULT_THREAD_IDENTIFIER
      : overrides.selectedThreadId;
  const selectedThreadIdRef: MutableRefObject<string | null> = {
    current: selectedThreadId,
  };
  const eventsConnectedRef: MutableRefObject<boolean> = {
    current: true,
  };
  const refreshActiveThreadListTracked = vi.fn(async () => {});
  const onReloadSelectedThread = vi.fn(async (_threadId: string) => {});
  const onInvalidateActiveThreadQuery = vi.fn();
  const reportTrackedUserInterfaceError = vi.fn(
    async (_input: {
      operation: string;
      actionId: string;
      threadId: string | null;
      error: Error | string | number | boolean | bigint | symbol | null | undefined | object;
      details?: Record<string, string | number | boolean | null>;
    }) => {},
  );

  const input: UseChatActionHandlersInput = {
    selectedThreadId,
    selectedAgentId: DEFAULT_AGENT_IDENTIFIER,
    modes: overrides.modes ?? DEFAULT_MODES,
    isModeSyncing: overrides.isModeSyncing ?? false,
    activeRequest: overrides.activeRequest ?? null,
    activeAuthTokenRefreshRequest: overrides.activeAuthTokenRefreshRequest ?? null,
    activeApplyPatchApprovalRequest: overrides.activeApplyPatchApprovalRequest ?? null,
    activeExecuteCommandApprovalRequest: overrides.activeExecuteCommandApprovalRequest ?? null,
    answerDraft: overrides.answerDraft ?? {},
    setAnswerDraft,
    buildActionRequestOptions,
    setIsBusy,
    setIsModeSyncing,
    setSelectedThreadId,
    selectedThreadIdRef,
    eventsConnectedRef,
    pendingThreadMaterializationCoordinator,
    readLastAppliedModeSignature: () => "",
    writeLastAppliedModeSignature: (_modeSignature) => {},
    chatRequestActionCoordinator,
    collaborationModeActionCoordinator,
    chatClient: createChatClient(),
    threadMutationClient: createThreadMutationClient(),
    pendingUserInputAnswerBuilder,
    onInvalidateActiveThreadQuery,
    refreshActiveThreadListTracked,
    onReloadSelectedThread,
    reportTrackedUserInterfaceError,
  };

  return {
    input,
    chatRequestActionCoordinator,
    collaborationModeActionCoordinator,
    pendingThreadMaterializationCoordinator,
    pendingUserInputAnswerBuilder,
    eventsConnectedRef,
    refreshActiveThreadListTracked,
    onReloadSelectedThread,
    setSelectedThreadId,
    selectedThreadIdRef,
  };
}

afterEach(() => {
  cleanup();
});

describe("UseChatActionHandlers", () => {
  it("synchronizes selected-thread owners and pending materialization callbacks for submitMessage", async () => {
    const {
      input,
      chatRequestActionCoordinator,
      pendingThreadMaterializationCoordinator,
      setSelectedThreadId,
      selectedThreadIdRef,
    } = createTestInput({
      selectedThreadId: null,
    });
    const markPendingSpy = vi.spyOn(pendingThreadMaterializationCoordinator, "markPending");
    const clearPendingSpy = vi.spyOn(pendingThreadMaterializationCoordinator, "clearPending");
    const sendMessageSpy = vi
      .spyOn(chatRequestActionCoordinator, "sendMessage")
      .mockImplementation(async (nextInput) => {
        nextInput.onMarkThreadPendingMaterialization(CREATED_THREAD_IDENTIFIER);
        nextInput.onThreadSelected(CREATED_THREAD_IDENTIFIER);
      });

    const handlerState: { current: ChatActionHandlers | null } = {
      current: null,
    };
    render(
      <HandlerHarness
        input={input}
        onHandlersReady={(handlers) => {
          handlerState.current = handlers;
        }}
      />,
    );

    await waitFor(() => {
      expect(handlerState.current).not.toBeNull();
    });

    const handlers = handlerState.current;
    if (handlers === null) {
      throw new Error("expected handlers to be ready");
    }
    await handlers.submitMessage("hello world");

    expect(sendMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: "hello world",
        selectedThreadId: null,
        selectedAgentId: DEFAULT_AGENT_IDENTIFIER,
      }),
    );
    expect(markPendingSpy).toHaveBeenCalledWith(CREATED_THREAD_IDENTIFIER);
    expect(clearPendingSpy).not.toHaveBeenCalled();
    expect(setSelectedThreadId).toHaveBeenCalledWith(CREATED_THREAD_IDENTIFIER);
    expect(selectedThreadIdRef.current).toBe(CREATED_THREAD_IDENTIFIER);
    expect(pendingThreadMaterializationCoordinator.isPending(CREATED_THREAD_IDENTIFIER)).toBe(true);
  });

  it("delegates mode draft application with the current owner state", async () => {
    const { input, collaborationModeActionCoordinator } = createTestInput();
    const applyDraftSpy = vi
      .spyOn(collaborationModeActionCoordinator, "applyDraft")
      .mockImplementation(async (nextInput) => {
        void nextInput;
      });

    const handlerState: { current: ChatActionHandlers | null } = {
      current: null,
    };
    render(
      <HandlerHarness
        input={input}
        onHandlersReady={(handlers) => {
          handlerState.current = handlers;
        }}
      />,
    );

    await waitFor(() => {
      expect(handlerState.current).not.toBeNull();
    });

    const handlers = handlerState.current;
    if (handlers === null) {
      throw new Error("expected handlers to be ready");
    }

    await handlers.applyModeDraft({
      modeKey: "default",
      modelId: "gpt-5",
      reasoningEffort: "medium",
    });

    expect(applyDraftSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: {
          modeKey: "default",
          modelId: "gpt-5",
          reasoningEffort: "medium",
        },
        selectedThreadId: DEFAULT_THREAD_IDENTIFIER,
        modes: DEFAULT_MODES,
        onSetModeSyncing: input.setIsModeSyncing,
      }),
    );
  });

  it("refreshes the active thread list before reloading the selected thread after chat refresh", async () => {
    const {
      input,
      chatRequestActionCoordinator,
      eventsConnectedRef,
      refreshActiveThreadListTracked,
      onReloadSelectedThread,
    } = createTestInput();
    eventsConnectedRef.current = false;
    const sendMessageSpy = vi
      .spyOn(chatRequestActionCoordinator, "sendMessage")
      .mockImplementation(async (nextInput) => {
        await nextInput.onRefreshThreadData(DEFAULT_THREAD_IDENTIFIER);
      });

    const handlerState: { current: ChatActionHandlers | null } = {
      current: null,
    };
    render(
      <HandlerHarness
        input={input}
        onHandlersReady={(handlers) => {
          handlerState.current = handlers;
        }}
      />,
    );

    await waitFor(() => {
      expect(handlerState.current).not.toBeNull();
    });

    const handlers = handlerState.current;
    if (handlers === null) {
      throw new Error("expected handlers to be ready");
    }
    await handlers.submitMessage("hello world");

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(refreshActiveThreadListTracked).toHaveBeenCalledTimes(1);
    expect(onReloadSelectedThread).toHaveBeenCalledWith(DEFAULT_THREAD_IDENTIFIER);
    expect(refreshActiveThreadListTracked.mock.invocationCallOrder[0]).toBeLessThan(
      onReloadSelectedThread.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
  });

  it("skips selected-thread reload after chat refresh when events are connected for the active thread", async () => {
    const {
      input,
      chatRequestActionCoordinator,
      eventsConnectedRef,
      refreshActiveThreadListTracked,
      onReloadSelectedThread,
    } = createTestInput();
    eventsConnectedRef.current = true;
    const sendMessageSpy = vi
      .spyOn(chatRequestActionCoordinator, "sendMessage")
      .mockImplementation(async (nextInput) => {
        await nextInput.onRefreshThreadData(DEFAULT_THREAD_IDENTIFIER);
      });

    const handlerState: { current: ChatActionHandlers | null } = {
      current: null,
    };
    render(
      <HandlerHarness
        input={input}
        onHandlersReady={(handlers) => {
          handlerState.current = handlers;
        }}
      />,
    );

    await waitFor(() => {
      expect(handlerState.current).not.toBeNull();
    });

    const handlers = handlerState.current;
    if (handlers === null) {
      throw new Error("expected handlers to be ready");
    }
    await handlers.submitMessage("hello world");

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(refreshActiveThreadListTracked).toHaveBeenCalledTimes(1);
    expect(onReloadSelectedThread).not.toHaveBeenCalled();
  });

  it("builds pending user input answers and submits the derived payload", async () => {
    const activeRequest = buildPendingUserInputRequest();
    const answerDraft: PendingUserInputAnswerDraftByQuestionId = {
      "question-1": {
        option: "Alpha",
        freeform: "",
      },
    };
    const { input, chatRequestActionCoordinator, pendingUserInputAnswerBuilder } = createTestInput({
      activeRequest,
      answerDraft,
    });
    const buildAnswersSpy = vi.spyOn(pendingUserInputAnswerBuilder, "buildAnswersByQuestionId");
    const submitPendingUserInputSpy = vi
      .spyOn(chatRequestActionCoordinator, "submitPendingUserInput")
      .mockImplementation(async (nextInput) => {
        void nextInput;
      });

    const handlerState: { current: ChatActionHandlers | null } = {
      current: null,
    };
    render(
      <HandlerHarness
        input={input}
        onHandlersReady={(handlers) => {
          handlerState.current = handlers;
        }}
      />,
    );

    await waitFor(() => {
      expect(handlerState.current).not.toBeNull();
    });

    const handlers = handlerState.current;
    if (handlers === null) {
      throw new Error("expected handlers to be ready");
    }
    await handlers.submitPendingRequest();

    expect(buildAnswersSpy).toHaveBeenCalledWith({
      questions: activeRequest.params.questions,
      answerDraftByQuestionId: answerDraft,
    });
    expect(submitPendingUserInputSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedThreadId: DEFAULT_THREAD_IDENTIFIER,
        requestId: activeRequest.id,
        answers: {
          "question-1": {
            answers: ["Alpha"],
          },
        },
      }),
    );
  });

  it("does not submit or skip pending requests when there is no active request", async () => {
    const { input, chatRequestActionCoordinator } = createTestInput({
      activeRequest: null,
    });
    const submitPendingUserInputSpy = vi.spyOn(
      chatRequestActionCoordinator,
      "submitPendingUserInput",
    );
    const skipPendingUserInputSpy = vi.spyOn(chatRequestActionCoordinator, "skipPendingUserInput");

    const handlerState: { current: ChatActionHandlers | null } = {
      current: null,
    };
    render(
      <HandlerHarness
        input={input}
        onHandlersReady={(handlers) => {
          handlerState.current = handlers;
        }}
      />,
    );

    await waitFor(() => {
      expect(handlerState.current).not.toBeNull();
    });

    const handlers = handlerState.current;
    if (handlers === null) {
      throw new Error("expected handlers to be ready");
    }
    await handlers.submitPendingRequest();
    await handlers.skipPendingRequest();

    expect(submitPendingUserInputSpy).not.toHaveBeenCalled();
    expect(skipPendingUserInputSpy).not.toHaveBeenCalled();
  });

  it("delegates auth-token-refresh request submission with the active auth request id", async () => {
    const activeAuthTokenRefreshRequest = buildPendingAuthTokenRefreshRequest();
    const { input, chatRequestActionCoordinator } = createTestInput({
      activeAuthTokenRefreshRequest,
    });
    const submitAuthTokenRefreshRequestSpy = vi
      .spyOn(chatRequestActionCoordinator, "submitAuthTokenRefreshRequest")
      .mockImplementation(async (nextInput) => {
        void nextInput;
      });

    const handlerState: { current: ChatActionHandlers | null } = {
      current: null,
    };
    render(
      <HandlerHarness
        input={input}
        onHandlersReady={(handlers) => {
          handlerState.current = handlers;
        }}
      />,
    );

    await waitFor(() => {
      expect(handlerState.current).not.toBeNull();
    });

    const handlers = handlerState.current;
    if (handlers === null || !handlers.submitAuthTokenRefreshRequest) {
      throw new Error("expected auth-token-refresh handler to be ready");
    }

    await handlers.submitAuthTokenRefreshRequest("token-72", "account-72", "pro");

    expect(submitAuthTokenRefreshRequestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedThreadId: DEFAULT_THREAD_IDENTIFIER,
        requestId: activeAuthTokenRefreshRequest.id,
        accessToken: "token-72",
        chatgptAccountId: "account-72",
        chatgptPlanType: "pro",
      }),
    );
  });

  it("does not submit auth-token-refresh requests when there is no active auth request", async () => {
    const { input, chatRequestActionCoordinator } = createTestInput({
      activeAuthTokenRefreshRequest: null,
    });
    const submitAuthTokenRefreshRequestSpy = vi.spyOn(
      chatRequestActionCoordinator,
      "submitAuthTokenRefreshRequest",
    );

    const handlerState: { current: ChatActionHandlers | null } = {
      current: null,
    };
    render(
      <HandlerHarness
        input={input}
        onHandlersReady={(handlers) => {
          handlerState.current = handlers;
        }}
      />,
    );

    await waitFor(() => {
      expect(handlerState.current).not.toBeNull();
    });

    const handlers = handlerState.current;
    if (handlers === null || !handlers.submitAuthTokenRefreshRequest) {
      throw new Error("expected auth-token-refresh handler to be ready");
    }

    await handlers.submitAuthTokenRefreshRequest("token-73", "account-73", null);

    expect(submitAuthTokenRefreshRequestSpy).not.toHaveBeenCalled();
  });

  it("delegates apply-patch approval submission with the active deprecated request id", async () => {
    const activeApplyPatchApprovalRequest = buildPendingApplyPatchApprovalRequest();
    const { input, chatRequestActionCoordinator } = createTestInput({
      activeApplyPatchApprovalRequest,
    });
    const submitApplyPatchApprovalRequestSpy = vi
      .spyOn(chatRequestActionCoordinator, "submitApplyPatchApprovalRequest")
      .mockImplementation(async (nextInput) => {
        void nextInput;
      });

    const handlerState: { current: ChatActionHandlers | null } = {
      current: null,
    };
    render(
      <HandlerHarness
        input={input}
        onHandlersReady={(handlers) => {
          handlerState.current = handlers;
        }}
      />,
    );

    await waitFor(() => {
      expect(handlerState.current).not.toBeNull();
    });

    const handlers = handlerState.current;
    if (handlers === null || !handlers.submitApplyPatchApprovalRequest) {
      throw new Error("expected apply-patch approval handler to be ready");
    }

    await handlers.submitApplyPatchApprovalRequest("approved");

    expect(submitApplyPatchApprovalRequestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedThreadId: DEFAULT_THREAD_IDENTIFIER,
        requestId: activeApplyPatchApprovalRequest.id,
        decision: "approved",
      }),
    );
  });

  it("does not submit execute-command approval when there is no active deprecated request", async () => {
    const { input, chatRequestActionCoordinator } = createTestInput({
      activeExecuteCommandApprovalRequest: null,
    });
    const submitExecuteCommandApprovalRequestSpy = vi.spyOn(
      chatRequestActionCoordinator,
      "submitExecuteCommandApprovalRequest",
    );

    const handlerState: { current: ChatActionHandlers | null } = {
      current: null,
    };
    render(
      <HandlerHarness
        input={input}
        onHandlersReady={(handlers) => {
          handlerState.current = handlers;
        }}
      />,
    );

    await waitFor(() => {
      expect(handlerState.current).not.toBeNull();
    });

    const handlers = handlerState.current;
    if (handlers === null || !handlers.submitExecuteCommandApprovalRequest) {
      throw new Error("expected execute-command approval handler to be ready");
    }

    await handlers.submitExecuteCommandApprovalRequest("denied");

    expect(submitExecuteCommandApprovalRequestSpy).not.toHaveBeenCalled();
  });

  it("delegates execute-command approval submission with the active deprecated request id", async () => {
    const activeExecuteCommandApprovalRequest = buildPendingExecuteCommandApprovalRequest();
    const { input, chatRequestActionCoordinator } = createTestInput({
      activeExecuteCommandApprovalRequest,
    });
    const submitExecuteCommandApprovalRequestSpy = vi
      .spyOn(chatRequestActionCoordinator, "submitExecuteCommandApprovalRequest")
      .mockImplementation(async (nextInput) => {
        void nextInput;
      });

    const handlerState: { current: ChatActionHandlers | null } = {
      current: null,
    };
    render(
      <HandlerHarness
        input={input}
        onHandlersReady={(handlers) => {
          handlerState.current = handlers;
        }}
      />,
    );

    await waitFor(() => {
      expect(handlerState.current).not.toBeNull();
    });

    const handlers = handlerState.current;
    if (handlers === null || !handlers.submitExecuteCommandApprovalRequest) {
      throw new Error("expected execute-command approval handler to be ready");
    }

    await handlers.submitExecuteCommandApprovalRequest("denied");

    expect(submitExecuteCommandApprovalRequestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedThreadId: DEFAULT_THREAD_IDENTIFIER,
        requestId: activeExecuteCommandApprovalRequest.id,
        decision: "denied",
      }),
    );
  });

  it("updates answer draft state for option and freeform fields while preserving existing values", async () => {
    const { input } = createTestInput();
    const harnessState: {
      handlers: ChatActionHandlers | null;
      answerDraft: PendingUserInputAnswerDraftByQuestionId;
    } = {
      handlers: null,
      answerDraft: {},
    };

    render(
      <StatefulAnswerHarness
        input={input}
        initialAnswerDraft={{}}
        onStateChanged={(handlers, answerDraft) => {
          harnessState.handlers = handlers;
          harnessState.answerDraft = answerDraft;
        }}
      />,
    );

    await waitFor(() => {
      expect(harnessState.handlers).not.toBeNull();
    });

    const handlers = harnessState.handlers;
    if (handlers === null) {
      throw new Error("expected handlers to be ready");
    }

    handlers.handleAnswerChange("question-1", "option", "Alpha");
    await waitFor(() => {
      expect(harnessState.answerDraft).toEqual({
        "question-1": {
          option: "Alpha",
          freeform: "",
        },
      });
    });

    handlers.handleAnswerChange("question-1", "freeform", "Other answer");
    await waitFor(() => {
      expect(harnessState.answerDraft).toEqual({
        "question-1": {
          option: "Alpha",
          freeform: "Other answer",
        },
      });
    });
  });
});

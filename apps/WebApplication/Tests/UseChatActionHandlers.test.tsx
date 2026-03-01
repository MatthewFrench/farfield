import { ChatGptAuthTokensRefreshRequestMethod } from "@farfield/protocol";
import { cleanup, render, waitFor } from "@testing-library/react";
import { type MutableRefObject, useEffect, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModeSelectionStateResolver } from "@/Features/Chat/DomainModel/ModeSelectionStateResolver";
import { type PendingAuthTokenRefreshRequest } from "@/Features/Chat/DomainModel/PendingAuthTokenRefreshRequestSelector";
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
  const loadCoreDataTracked = vi.fn(async () => {});
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
    answerDraft: overrides.answerDraft ?? {},
    setAnswerDraft,
    buildActionRequestOptions,
    setIsBusy,
    setIsModeSyncing,
    setSelectedThreadId,
    selectedThreadIdRef,
    pendingThreadMaterializationCoordinator,
    readLastAppliedModeSignature: () => "",
    writeLastAppliedModeSignature: (_modeSignature) => {},
    chatRequestActionCoordinator,
    collaborationModeActionCoordinator,
    chatClient: createChatClient(),
    threadMutationClient: createThreadMutationClient(),
    pendingUserInputAnswerBuilder,
    onInvalidateActiveThreadQuery,
    loadCoreDataTracked,
    onReloadSelectedThread,
    reportTrackedUserInterfaceError,
  };

  return {
    input,
    chatRequestActionCoordinator,
    collaborationModeActionCoordinator,
    pendingThreadMaterializationCoordinator,
    pendingUserInputAnswerBuilder,
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
        nextInput.onClearThreadPendingMaterialization(CREATED_THREAD_IDENTIFIER);
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
    expect(clearPendingSpy).toHaveBeenCalledWith(CREATED_THREAD_IDENTIFIER);
    expect(setSelectedThreadId).toHaveBeenCalledWith(CREATED_THREAD_IDENTIFIER);
    expect(selectedThreadIdRef.current).toBe(CREATED_THREAD_IDENTIFIER);
    expect(pendingThreadMaterializationCoordinator.isPending(CREATED_THREAD_IDENTIFIER)).toBe(
      false,
    );
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

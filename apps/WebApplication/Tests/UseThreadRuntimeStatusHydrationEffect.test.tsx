import { cleanup, render, waitFor } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThreadServerClient } from "@/Features/Threads/DataAccess/ThreadServerClient";
import { type ThreadListItem } from "@/Features/Threads/DomainModel/ThreadGroupTypes";
import {
  type ThreadRuntimeStatusByThreadIdentifier,
  type ThreadRuntimeStatusSnapshot,
} from "@/Features/Threads/DomainModel/ThreadRuntimeStatusContracts";
import { useThreadRuntimeStatusHydrationEffect } from "@/Features/Threads/StateManagement/UseThreadRuntimeStatusHydrationEffect";

const HYDRATED_THREAD_RUNTIME_STATUS_SEQUENCE = -2;
const PENDING_THREAD_RUNTIME_STATUS_SEQUENCE = -1;

interface HarnessProperties {
  input: HarnessInput;
}

interface HarnessInput {
  ensureApiSessionBootstrapped: () => Promise<boolean>;
  canHydrateThreadRuntimeStatuses: boolean;
  selectedAgentId: "codex" | "opencode";
  threads: ThreadListItem[];
  threadServerClient: ThreadServerClient;
  initialThreadRuntimeStatusByThreadIdentifier: ThreadRuntimeStatusByThreadIdentifier;
  onThreadRuntimeStatusChange: (value: ThreadRuntimeStatusByThreadIdentifier) => void;
  handleRuntimeRequestError: <ErrorType>(error: ErrorType) => void;
}

function Harness({ input }: HarnessProperties): React.JSX.Element {
  const [threadRuntimeStatusByThreadIdentifier, setThreadRuntimeStatusByThreadIdentifier] =
    useState<ThreadRuntimeStatusByThreadIdentifier>(
      input.initialThreadRuntimeStatusByThreadIdentifier,
    );

  useThreadRuntimeStatusHydrationEffect({
    ensureApiSessionBootstrapped: input.ensureApiSessionBootstrapped,
    canHydrateThreadRuntimeStatuses: input.canHydrateThreadRuntimeStatuses,
    selectedAgentId: input.selectedAgentId,
    threads: input.threads,
    threadServerClient: input.threadServerClient,
    setThreadRuntimeStatusByThreadIdentifier,
    handleRuntimeRequestError: input.handleRuntimeRequestError,
  });

  useEffect(() => {
    input.onThreadRuntimeStatusChange(threadRuntimeStatusByThreadIdentifier);
  }, [input, threadRuntimeStatusByThreadIdentifier]);

  return <></>;
}

function createThreadRuntimeStatusSnapshot(input: {
  sequence: number;
  activeFlags: ThreadRuntimeStatusSnapshot["activeFlags"];
  receivedAtMilliseconds: number;
}): ThreadRuntimeStatusSnapshot {
  return {
    sequence: input.sequence,
    statusType: "active",
    activeFlags: input.activeFlags,
    receivedAtMilliseconds: input.receivedAtMilliseconds,
  };
}

function createHarnessInput(overrides: Partial<HarnessInput> = {}): HarnessInput {
  const threadServerClient = new ThreadServerClient();
  return {
    ensureApiSessionBootstrapped: vi.fn(async (): Promise<boolean> => true),
    canHydrateThreadRuntimeStatuses: true,
    selectedAgentId: "codex",
    threads: [
      {
        id: "thread-1",
        preview: "Preview 1",
        createdAt: 1,
        updatedAt: 2,
        cwd: "/tmp/project",
        path: "/tmp/project",
        agentId: "codex",
        hasUnreadTurn: null,
        isProjectRemoved: false,
      },
      {
        id: "thread-2",
        preview: "Preview 2",
        createdAt: 3,
        updatedAt: 4,
        cwd: "/tmp/project",
        path: "/tmp/project",
        agentId: "codex",
        hasUnreadTurn: null,
        isProjectRemoved: false,
      },
    ],
    threadServerClient,
    initialThreadRuntimeStatusByThreadIdentifier: {},
    onThreadRuntimeStatusChange: () => {},
    handleRuntimeRequestError: function handleRuntimeRequestError<ErrorType>(
      _error: ErrorType,
    ): void {},
    ...overrides,
  };
}

describe("useThreadRuntimeStatusHydrationEffect", () => {
  afterEach(() => {
    cleanup();
  });

  it("hydrates active runtime statuses for the current thread list", async () => {
    const input = createHarnessInput();
    const readThreadRuntimeStatuses = vi
      .spyOn(input.threadServerClient, "readThreadRuntimeStatuses")
      .mockResolvedValue({
        statuses: [
          {
            threadId: "thread-2",
            statusType: "active",
            activeFlags: ["waitingOnApproval"],
            receivedAtMilliseconds: 1_700_000_000_250,
          },
        ],
      });
    const onThreadRuntimeStatusChange = vi.fn(
      (_value: ThreadRuntimeStatusByThreadIdentifier): void => {},
    );
    input.onThreadRuntimeStatusChange = onThreadRuntimeStatusChange;

    render(<Harness input={input} />);

    await waitFor(() => {
      expect(readThreadRuntimeStatuses).toHaveBeenCalledWith({
        agentId: "codex",
        threadIds: ["thread-1", "thread-2"],
      });
    });

    await waitFor(() => {
      expect(onThreadRuntimeStatusChange).toHaveBeenCalledWith({
        "thread-2": createThreadRuntimeStatusSnapshot({
          sequence: HYDRATED_THREAD_RUNTIME_STATUS_SEQUENCE,
          activeFlags: ["waitingOnApproval"],
          receivedAtMilliseconds: 1_700_000_000_250,
        }),
      });
    });
  });

  it("clears only startup-hydrated statuses when the refresh returns no active entry", async () => {
    const input = createHarnessInput({
      initialThreadRuntimeStatusByThreadIdentifier: {
        "thread-1": createThreadRuntimeStatusSnapshot({
          sequence: HYDRATED_THREAD_RUNTIME_STATUS_SEQUENCE,
          activeFlags: [],
          receivedAtMilliseconds: 1_700_000_000_100,
        }),
        "thread-2": createThreadRuntimeStatusSnapshot({
          sequence: PENDING_THREAD_RUNTIME_STATUS_SEQUENCE,
          activeFlags: ["waitingOnUserInput"],
          receivedAtMilliseconds: 1_700_000_000_200,
        }),
      },
    });
    vi.spyOn(input.threadServerClient, "readThreadRuntimeStatuses").mockResolvedValue({
      statuses: [],
    });
    const onThreadRuntimeStatusChange = vi.fn(
      (_value: ThreadRuntimeStatusByThreadIdentifier): void => {},
    );
    input.onThreadRuntimeStatusChange = onThreadRuntimeStatusChange;

    render(<Harness input={input} />);

    await waitFor(() => {
      expect(onThreadRuntimeStatusChange).toHaveBeenCalledWith({
        "thread-2": createThreadRuntimeStatusSnapshot({
          sequence: PENDING_THREAD_RUNTIME_STATUS_SEQUENCE,
          activeFlags: ["waitingOnUserInput"],
          receivedAtMilliseconds: 1_700_000_000_200,
        }),
      });
    });
  });
});

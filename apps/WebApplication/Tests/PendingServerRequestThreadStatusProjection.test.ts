import {
  ApplyPatchApprovalRequestMethod,
  CommandExecutionApprovalRequestMethod,
  FileChangeApprovalRequestMethod,
  ToolCallRequestMethod,
  UserInputRequestMethod,
} from "@farfield/protocol";
import { describe, expect, it } from "vitest";
import {
  applyPendingServerRequestThreadStatuses,
  isPendingServerRequestThreadStatus,
  PENDING_SERVER_REQUEST_THREAD_STATUS_SEQUENCE,
  projectPendingServerRequestsToThreadRuntimeStatuses,
} from "@/Application/StateManagement/PendingServerRequestThreadStatusProjection";
import { type CapabilityPendingServerRequestsResponse } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";

describe("PendingServerRequestThreadStatusProjection", () => {
  it("projects approval and user-input pending requests into per-thread runtime statuses", () => {
    const response: CapabilityPendingServerRequestsResponse = {
      ok: true,
      requests: [
        {
          requestId: 11,
          method: CommandExecutionApprovalRequestMethod,
          params: {
            threadId: "thread-approval",
            turnId: "turn-1",
            itemId: "item-1",
            approvalId: null,
            command: "git status",
          },
          receivedAtMilliseconds: 5_100,
        },
        {
          requestId: 12,
          method: FileChangeApprovalRequestMethod,
          params: {
            threadId: "thread-approval",
            turnId: "turn-1",
            itemId: "item-2",
            reason: "Needs write access",
          },
          receivedAtMilliseconds: 5_300,
        },
        {
          requestId: 13,
          method: UserInputRequestMethod,
          params: {
            threadId: "thread-input",
            turnId: "turn-2",
            itemId: "item-3",
            questions: [
              {
                id: "question-1",
                header: "Choose",
                question: "Which option should run?",
                isOther: false,
                isSecret: false,
                options: [
                  {
                    label: "One",
                    description: "Use the first option.",
                  },
                ],
              },
            ],
          },
          receivedAtMilliseconds: 5_400,
        },
        {
          requestId: 14,
          method: ToolCallRequestMethod,
          params: {
            threadId: "thread-input",
            turnId: "turn-2",
            callId: "call-14",
            tool: "browser_open",
            arguments: {
              path: "/tmp/output.txt",
            },
          },
          receivedAtMilliseconds: 5_450,
        },
        {
          requestId: 15,
          method: ApplyPatchApprovalRequestMethod,
          params: {
            callId: "call-15",
          },
          receivedAtMilliseconds: 5_500,
        },
        {
          requestId: 16,
          method: "future/request",
          params: {
            threadId: "thread-ignored",
          },
          receivedAtMilliseconds: 5_600,
        },
      ],
    };

    expect(projectPendingServerRequestsToThreadRuntimeStatuses(response)).toEqual({
      "thread-approval": {
        sequence: PENDING_SERVER_REQUEST_THREAD_STATUS_SEQUENCE,
        statusType: "active",
        activeFlags: ["waitingOnApproval"],
        receivedAtMilliseconds: 5_300,
      },
      "thread-input": {
        sequence: PENDING_SERVER_REQUEST_THREAD_STATUS_SEQUENCE,
        statusType: "active",
        activeFlags: ["waitingOnUserInput"],
        receivedAtMilliseconds: 5_450,
      },
    });
  });

  it("adds and removes synthetic pending-request statuses while preserving unrelated notification statuses", () => {
    const previousStatusByThreadIdentifier = {
      "thread-pending-stale": {
        sequence: PENDING_SERVER_REQUEST_THREAD_STATUS_SEQUENCE,
        statusType: "active" as const,
        activeFlags: ["waitingOnApproval" as const],
        receivedAtMilliseconds: 4_000,
      },
      "thread-notification": {
        sequence: 27,
        statusType: "idle" as const,
        activeFlags: [],
        receivedAtMilliseconds: 4_100,
      },
      "thread-stable-notification": {
        sequence: 31,
        statusType: "active" as const,
        activeFlags: [],
        receivedAtMilliseconds: 4_200,
      },
    };

    const nextPendingStatusByThreadIdentifier = {
      "thread-notification": {
        sequence: PENDING_SERVER_REQUEST_THREAD_STATUS_SEQUENCE,
        statusType: "active" as const,
        activeFlags: ["waitingOnApproval" as const, "waitingOnUserInput" as const],
        receivedAtMilliseconds: 5_200,
      },
      "thread-new": {
        sequence: PENDING_SERVER_REQUEST_THREAD_STATUS_SEQUENCE,
        statusType: "active" as const,
        activeFlags: ["waitingOnUserInput" as const],
        receivedAtMilliseconds: 5_300,
      },
    };

    expect(
      applyPendingServerRequestThreadStatuses({
        previousStatusByThreadIdentifier,
        nextPendingStatusByThreadIdentifier,
      }),
    ).toEqual({
      "thread-notification": {
        sequence: PENDING_SERVER_REQUEST_THREAD_STATUS_SEQUENCE,
        statusType: "active",
        activeFlags: ["waitingOnApproval", "waitingOnUserInput"],
        receivedAtMilliseconds: 5_200,
      },
      "thread-new": {
        sequence: PENDING_SERVER_REQUEST_THREAD_STATUS_SEQUENCE,
        statusType: "active",
        activeFlags: ["waitingOnUserInput"],
        receivedAtMilliseconds: 5_300,
      },
      "thread-stable-notification": {
        sequence: 31,
        statusType: "active",
        activeFlags: [],
        receivedAtMilliseconds: 4_200,
      },
    });
  });

  it("marks only synthetic sequence entries as pending-request statuses", () => {
    expect(
      isPendingServerRequestThreadStatus({
        sequence: PENDING_SERVER_REQUEST_THREAD_STATUS_SEQUENCE,
        statusType: "active",
        activeFlags: ["waitingOnApproval"],
        receivedAtMilliseconds: 10,
      }),
    ).toBe(true);

    expect(
      isPendingServerRequestThreadStatus({
        sequence: 1,
        statusType: "active",
        activeFlags: ["waitingOnApproval"],
        receivedAtMilliseconds: 10,
      }),
    ).toBe(false);
  });

  it("fails when a known pending approval request does not satisfy the schema", () => {
    const response: CapabilityPendingServerRequestsResponse = {
      ok: true,
      requests: [
        {
          requestId: 17,
          method: CommandExecutionApprovalRequestMethod,
          params: {
            turnId: "turn-17",
            itemId: "item-17",
          },
          receivedAtMilliseconds: 5_700,
        },
      ],
    };

    expect(() => projectPendingServerRequestsToThreadRuntimeStatuses(response)).toThrowError();
  });
});

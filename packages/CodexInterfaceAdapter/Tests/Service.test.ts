import { describe, expect, it, vi, type Mock } from "vitest";
import {
  IpcResponseFrameSchema,
  type IpcResponseFrame,
  type JsonValue,
  type ThreadConversationState,
  type TurnStartParams
} from "@farfield/protocol";
import {
  CodexMonitorService,
  type CodexMonitorIpcClient,
  type ThreadFollowerRequestOptions
} from "../Source/Service.js";

type SendRequestAndWaitFunction = (
  method: string,
  params: JsonValue,
  options: ThreadFollowerRequestOptions
) => Promise<IpcResponseFrame>;

type SendRequestAndWaitMock = Mock<SendRequestAndWaitFunction>;

interface ServiceIpcClientDouble {
  ipcClient: CodexMonitorIpcClient;
  sendRequestAndWait: SendRequestAndWaitMock;
}

function createThread(): ThreadConversationState {
  return {
    id: "thread-1",
    turns: [
      {
        params: {
          threadId: "thread-1",
          input: [{ type: "text", text: "hello" }],
          attachments: []
        },
        status: "completed",
        items: []
      }
    ],
    requests: []
  };
}

function createIpcSuccessResponse(): IpcResponseFrame {
  return IpcResponseFrameSchema.parse({
    type: "response",
    requestId: "request-1",
    resultType: "success",
    result: {}
  });
}

function createServiceIpcClientDouble(): ServiceIpcClientDouble {
  const sendRequestAndWait: SendRequestAndWaitMock = vi.fn<SendRequestAndWaitFunction>();
  sendRequestAndWait.mockResolvedValue(createIpcSuccessResponse());

  const ipcClient: CodexMonitorIpcClient = {
    sendRequestAndWait
  };

  return {
    ipcClient,
    sendRequestAndWait
  };
}

function requireTurnStartTemplate(
  thread: ThreadConversationState
): TurnStartParams {
  const template = thread.turns[0]?.params;
  if (!template) {
    throw new Error("Expected turn start template");
  }
  return template;
}

describe("CodexMonitorService", () => {
  it("sends message using strict thread template", async () => {
    const serviceIpcClientDouble = createServiceIpcClientDouble();
    const service = new CodexMonitorService(serviceIpcClientDouble.ipcClient);

    await service.sendMessage({
      threadId: "thread-1",
      ownerClientId: "client-1",
      text: "new message",
      turnStartTemplate: requireTurnStartTemplate(createThread())
    });

    expect(serviceIpcClientDouble.sendRequestAndWait).toHaveBeenCalledWith(
      "thread-follower-start-turn",
      expect.objectContaining({
        conversationId: "thread-1"
      }),
      {
        targetClientId: "client-1",
        version: 1
      }
    );
  });

  it("overrides template mode and model when provided", async () => {
    const serviceIpcClientDouble = createServiceIpcClientDouble();
    const service = new CodexMonitorService(serviceIpcClientDouble.ipcClient);

    await service.sendMessage({
      threadId: "thread-1",
      ownerClientId: "client-1",
      text: "new message",
      turnStartTemplate: requireTurnStartTemplate(createThread()),
      model: "gpt-5.3-codex",
      effort: "high",
      collaborationMode: {
        mode: "plan",
        settings: {
          model: "gpt-5.3-codex",
          reasoning_effort: "high",
          developer_instructions: "plan"
        }
      }
    });

    expect(serviceIpcClientDouble.sendRequestAndWait).toHaveBeenCalledWith(
      "thread-follower-start-turn",
      expect.objectContaining({
        turnStartParams: expect.objectContaining({
          model: "gpt-5.3-codex",
          effort: "high",
          collaborationMode: expect.objectContaining({
            mode: "plan"
          })
        })
      }),
      expect.any(Object)
    );
  });

  it("sends message without a template when none is available", async () => {
    const serviceIpcClientDouble = createServiceIpcClientDouble();
    const service = new CodexMonitorService(serviceIpcClientDouble.ipcClient);

    await service.sendMessage({
      threadId: "thread-1",
      ownerClientId: "client-1",
      text: "new message without template",
      cwd: "/tmp/project"
    });

    expect(serviceIpcClientDouble.sendRequestAndWait).toHaveBeenCalledWith(
      "thread-follower-start-turn",
      expect.objectContaining({
        conversationId: "thread-1",
        turnStartParams: expect.objectContaining({
          threadId: "thread-1",
          cwd: "/tmp/project",
          input: [
            {
              type: "text",
              text: "new message without template"
            }
          ]
        })
      }),
      expect.any(Object)
    );
  });

  it("rejects empty message text before sending IPC requests", async () => {
    const serviceIpcClientDouble = createServiceIpcClientDouble();
    const service = new CodexMonitorService(serviceIpcClientDouble.ipcClient);

    await expect(
      service.sendMessage({
        threadId: "thread-1",
        ownerClientId: "client-1",
        text: "   "
      })
    ).rejects.toThrowError("Message text is required");

    expect(serviceIpcClientDouble.sendRequestAndWait).not.toHaveBeenCalled();
  });

  it("sends collaboration mode updates to the owner client", async () => {
    const serviceIpcClientDouble = createServiceIpcClientDouble();
    const service = new CodexMonitorService(serviceIpcClientDouble.ipcClient);

    await service.setCollaborationMode({
      threadId: "thread-1",
      ownerClientId: "client-1",
      collaborationMode: {
        mode: "plan"
      }
    });

    expect(serviceIpcClientDouble.sendRequestAndWait).toHaveBeenCalledWith(
      "thread-follower-set-collaboration-mode",
      expect.objectContaining({
        conversationId: "thread-1",
        collaborationMode: expect.objectContaining({
          mode: "plan"
        })
      }),
      {
        targetClientId: "client-1",
        version: 1
      }
    );
  });

  it("submits user input with validated payload", async () => {
    const serviceIpcClientDouble = createServiceIpcClientDouble();
    const service = new CodexMonitorService(serviceIpcClientDouble.ipcClient);

    await service.submitUserInput({
      threadId: "thread-1",
      ownerClientId: "client-1",
      requestId: 7,
      response: {
        answers: {
          q1: {
            answers: ["Option A"]
          }
        }
      }
    });

    expect(serviceIpcClientDouble.sendRequestAndWait).toHaveBeenCalledWith(
      "thread-follower-submit-user-input",
      expect.objectContaining({
        conversationId: "thread-1",
        requestId: 7,
        response: {
          answers: {
            q1: {
              answers: ["Option A"]
            }
          }
        }
      }),
      {
        targetClientId: "client-1",
        version: 1
      }
    );
  });

  it("sends interrupt requests to the current owner client", async () => {
    const serviceIpcClientDouble = createServiceIpcClientDouble();
    const service = new CodexMonitorService(serviceIpcClientDouble.ipcClient);

    await service.interrupt({
      threadId: "thread-1",
      ownerClientId: "client-1"
    });

    expect(serviceIpcClientDouble.sendRequestAndWait).toHaveBeenCalledWith(
      "thread-follower-interrupt-turn",
      expect.objectContaining({
        conversationId: "thread-1"
      }),
      {
        targetClientId: "client-1",
        version: 1
      }
    );
  });

  it("rejects invalid user input payloads", async () => {
    const serviceIpcClientDouble = createServiceIpcClientDouble();
    const service = new CodexMonitorService(serviceIpcClientDouble.ipcClient);

    await expect(
      service.submitUserInput({
        threadId: "thread-1",
        ownerClientId: "client-1",
        requestId: 7,
        response: {
          answers: {
            q1: {
              freeResponse: ""
            }
          }
        }
      })
    ).rejects.toThrowError(/did not match expected schema/i);
  });
});

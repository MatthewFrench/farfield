import { UserInputRequestMethod } from "@farfield/protocol";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getLiveState,
  getStreamEvents,
  interruptThread,
  sendMessage,
  setCollaborationMode,
  submitUserInput,
} from "@/Features/Chat/DataAccess/ChatApi";
import { type StructuredDataValue } from "@/Shared/Contracts/StructuredDataValue";

function createJsonResponse(body: StructuredDataValue, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ChatApi", () => {
  it("rejects stream-event requests when sinceSequence is negative", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        ok: true,
        threadId: "thread_1",
        ownerClientId: null,
        events: [],
        nextSequence: 0,
        firstAvailableSequence: 0,
        resetRequired: false,
      }),
    );

    await expect(
      getStreamEvents("thread_1", {
        sinceSequence: -1,
      }),
    ).rejects.toThrow(/greater than or equal to 0/);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("includes stream-event cursor query parameters when provided", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        ok: true,
        threadId: "thread_1",
        ownerClientId: null,
        events: [],
        nextSequence: 12,
        firstAvailableSequence: 0,
        resetRequired: false,
      }),
    );

    await getStreamEvents("thread_1", {
      sinceSequence: 11,
    });

    const requestUrl = String(fetchMock.mock.calls[0]?.[0] ?? "");
    const parsedUrl = new URL(requestUrl, "http://localhost");
    expect(parsedUrl.pathname).toBe("/api/threads/thread_1/stream-events");
    expect(parsedUrl.searchParams.get("limit")).toBe("80");
    expect(parsedUrl.searchParams.get("sinceSequence")).toBe("11");
  });

  it("fails live-state parsing when liveStateError payload violates the boundary schema", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        ok: true,
        threadId: "thread_1",
        ownerClientId: null,
        conversationState: null,
        liveStateError: {
          kind: "reductionFailed",
          message: "",
          eventIndex: null,
          patchIndex: null,
        },
      }),
    );

    await expect(getLiveState("thread_1")).rejects.toThrow(/at least 1 character/);
  });

  it("projects live-state responses to the owned contract when transport includes extra keys", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        ok: true,
        threadId: "thread_1",
        ownerClientId: null,
        conversationState: null,
        liveStateError: null,
        extraKey: "ignored",
      }),
    );

    const result = await getLiveState("thread_1");

    expect(result.threadId).toBe("thread_1");
    expect("extraKey" in result).toBe(false);
  });

  it("rejects stream-events parsing when resetRequired is not a boolean", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        ok: true,
        threadId: "thread_1",
        ownerClientId: null,
        events: [],
        nextSequence: 12,
        firstAvailableSequence: 0,
        resetRequired: "false",
      }),
    );

    await expect(getStreamEvents("thread_1")).rejects.toThrow(/resetRequired/);
  });

  it("rejects send-message requests before dispatch when message text is empty", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, {
        status: 200,
      }),
    );

    await expect(
      sendMessage({
        threadId: "thread_1",
        text: "",
      }),
    ).rejects.toThrow(/at least 1 character/);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("posts send-message payload through the messages route with JSON headers", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, {
        status: 200,
      }),
    );

    await sendMessage({
      threadId: "thread_1",
      ownerClientId: "owner_1",
      text: "hello",
      cwd: "/tmp/workspace",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestUrl = String(fetchMock.mock.calls[0]?.[0] ?? "");
    const requestInit = fetchMock.mock.calls[0]?.[1];
    expect(requestUrl).toContain("/api/threads/thread_1/messages");
    expect(requestInit?.method).toBe("POST");
    expect(new Headers(requestInit?.headers).get("Content-Type")).toBe("application/json");
    expect(String(requestInit?.body)).toBe(
      JSON.stringify({
        ownerClientId: "owner_1",
        text: "hello",
        cwd: "/tmp/workspace",
      }),
    );
  });

  it("posts collaboration-mode requests through the collaboration-mode route", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, {
        status: 200,
      }),
    );

    await setCollaborationMode({
      threadId: "thread_1",
      collaborationMode: {
        mode: "plan",
        settings: {
          model: null,
          reasoning_effort: "high",
          developer_instructions: "Use explicit reasoning.",
        },
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestUrl = String(fetchMock.mock.calls[0]?.[0] ?? "");
    const requestInit = fetchMock.mock.calls[0]?.[1];
    expect(requestUrl).toContain("/api/threads/thread_1/collaboration-mode");
    expect(requestInit?.method).toBe("POST");
    expect(new Headers(requestInit?.headers).get("Content-Type")).toBe("application/json");
    expect(String(requestInit?.body)).toBe(
      JSON.stringify({
        collaborationMode: {
          mode: "plan",
          settings: {
            model: null,
            reasoning_effort: "high",
            developer_instructions: "Use explicit reasoning.",
          },
        },
      }),
    );
  });

  it("rejects collaboration-mode requests before dispatch when threadId is blank", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, {
        status: 200,
      }),
    );

    await expect(
      setCollaborationMode({
        threadId: "",
        collaborationMode: {
          mode: "plan",
          settings: {
            model: null,
            reasoning_effort: null,
            developer_instructions: null,
          },
        },
      }),
    ).rejects.toThrow(/at least 1 character/);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("posts interrupt requests through the interrupt route with an empty body by default", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, {
        status: 200,
      }),
    );

    await interruptThread({
      threadId: "thread_1",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestUrl = String(fetchMock.mock.calls[0]?.[0] ?? "");
    const requestInit = fetchMock.mock.calls[0]?.[1];
    expect(requestUrl).toContain("/api/threads/thread_1/interrupt");
    expect(requestInit?.method).toBe("POST");
    expect(new Headers(requestInit?.headers).get("Content-Type")).toBe("application/json");
    expect(String(requestInit?.body)).toBe("{}");
  });

  it("rejects user-input submission when requestId is negative", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, {
        status: 200,
      }),
    );

    await expect(
      submitUserInput({
        threadId: "thread_1",
        requestId: -1,
        response: {
          method: UserInputRequestMethod,
          payload: {
            answers: {
              question_1: {
                answers: ["answer"],
              },
            },
          },
        },
      }),
    ).rejects.toThrow(/greater than or equal to 0/);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });
});

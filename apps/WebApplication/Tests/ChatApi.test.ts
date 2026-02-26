import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getLiveState,
  getStreamEvents,
  sendMessage,
  submitUserInput
} from "@/Features/Chat/DataAccess/ChatApi";
import { type StructuredDataValue } from "@/Shared/Contracts/StructuredDataValue";

function createJsonResponse(body: StructuredDataValue, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
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
        resetRequired: false
      })
    );

    await expect(
      getStreamEvents("thread_1", {
        sinceSequence: -1
      })
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
        resetRequired: false
      })
    );

    await getStreamEvents("thread_1", {
      sinceSequence: 11
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
          patchIndex: null
        }
      })
    );

    await expect(getLiveState("thread_1")).rejects.toThrow(/at least 1 character/);
  });

  it("rejects send-message requests before dispatch when message text is empty", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, {
      status: 200
    }));

    await expect(
      sendMessage({
        threadId: "thread_1",
        text: ""
      })
    ).rejects.toThrow(/at least 1 character/);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("rejects user-input submission when requestId is negative", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, {
      status: 200
    }));

    await expect(
      submitUserInput({
        threadId: "thread_1",
        requestId: -1,
        response: {
          answers: {
            question_1: {
              answers: ["answer"]
            }
          }
        }
      })
    ).rejects.toThrow(/greater than or equal to 0/);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { type StructuredDataValue } from "../Source/Shared/Contracts/StructuredDataValue";
import { RequestCanceledError } from "../Source/Shared/Errors/RequestCanceledError";
import {
  applyRequestOptions,
  FarfieldHttpRequestFailureError,
  request,
  requestNoContent,
} from "../Source/Shared/Transport/FarfieldHttpTransport";

function createJsonResponse(body: StructuredDataValue, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function createLargeEnvelope(payloadLength: number): StructuredDataValue {
  return {
    ok: true,
    data: "x".repeat(payloadLength),
  };
}

function createAbortError(): Error {
  const abortError = new Error("The operation was aborted.");
  abortError.name = "AbortError";
  return abortError;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("FarfieldHttpTransport", () => {
  it("parses 6k JSON payloads without truncating parse input", async () => {
    const payload = createLargeEnvelope(6_000);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(createJsonResponse(payload));

    const result = await request("/api/large-payload");
    expect(result).toEqual(payload);
  });

  it("parses 20k JSON payloads without truncating parse input", async () => {
    const payload = createLargeEnvelope(20_000);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(createJsonResponse(payload));

    const result = await request("/api/large-payload");
    expect(result).toEqual(payload);
  });

  it("parses 100k JSON payloads without truncating parse input", async () => {
    const payload = createLargeEnvelope(100_000);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(createJsonResponse(payload));

    const result = await request("/api/large-payload");
    expect(result).toEqual(payload);
  });

  it("keeps response-text truncation scoped to diagnostics when JSON parsing fails", async () => {
    const brokenJson = `{"ok":true,"data":"${"x".repeat(8_000)}`;
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(brokenJson, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    let requestFailureError: FarfieldHttpRequestFailureError | null = null;
    try {
      await request("/api/invalid-large-json");
    } catch (error) {
      if (error instanceof FarfieldHttpRequestFailureError) {
        requestFailureError = error;
      } else {
        throw error;
      }
    }

    expect(requestFailureError).toBeTruthy();
    if (!requestFailureError) {
      return;
    }

    expect(requestFailureError.requestFailureDetails.responseTextTruncated).toBe(true);
    expect(requestFailureError.requestFailureDetails.responseTextLength).toBe(brokenJson.length);
    expect(requestFailureError.requestFailureDetails.responseText).toContain("[truncated]");
  });

  it("propagates api error messages for non-ok no-content responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse(
        {
          ok: false,
          error: "Nope",
        },
        500,
      ),
    );

    await expect(requestNoContent("/api/no-content")).rejects.toThrow("Nope");
  });

  it("rejects responses that do not satisfy the api envelope contract", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        data: "missing-ok-field",
      }),
    );

    await expect(request("/api/missing-envelope")).rejects.toThrow(
      "Invalid API envelope from /api/missing-envelope",
    );
  });

  it("uses generic request failure messages when api error envelopes include extra keys", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse(
        {
          ok: false,
          error: "Nope",
          details: "unexpected-extra-field",
        },
        500,
      ),
    );

    let requestFailureError: FarfieldHttpRequestFailureError | null = null;
    try {
      await requestNoContent("/api/no-content-strict-error-envelope");
    } catch (error) {
      if (error instanceof FarfieldHttpRequestFailureError) {
        requestFailureError = error;
      } else {
        throw error;
      }
    }

    expect(requestFailureError).toBeTruthy();
    if (!requestFailureError) {
      return;
    }
    expect(requestFailureError.message).toContain(
      "Request failed for /api/no-content-strict-error-envelope",
    );
    expect(requestFailureError.message).not.toContain("Nope");
  });

  it("trims and applies action metadata headers while preserving existing headers", () => {
    const abortController = new AbortController();
    const init: RequestInit = {
      headers: {
        "X-Custom": "custom-value",
      },
    };

    const nextInit = applyRequestOptions(init, {
      actionId: "  action_1  ",
      actionName: "  send-message  ",
      signal: abortController.signal,
    });
    const nextHeaders = new Headers(nextInit.headers);

    expect(nextHeaders.get("X-Custom")).toBe("custom-value");
    expect(nextHeaders.get("X-Farfield-Action-Id")).toBe("action_1");
    expect(nextHeaders.get("X-Farfield-Action-Name")).toBe("send-message");
    expect(nextInit.signal).toBe(abortController.signal);
  });

  it("rejects blank action metadata values", () => {
    expect(() =>
      applyRequestOptions(
        {},
        {
          actionId: "   ",
          actionName: "   ",
        },
      ),
    ).toThrow("Request metadata values must not be blank");
  });

  it("rejects non-token action metadata values", () => {
    expect(() =>
      applyRequestOptions(
        {},
        {
          actionId: "action value",
          actionName: "send message",
        },
      ),
    ).toThrow("Request metadata values may contain only letters");
  });

  it("rejects request calls when the path is blank", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        ok: true,
      }),
    );

    await expect(request("   ")).rejects.toThrow("Request path must not be blank");
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("includes timeout duration and request id when a request exceeds the timeout budget", async () => {
    vi.useFakeTimers();
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => {
            reject(createAbortError());
          },
          { once: true },
        );
      });
    });

    try {
      const requestPromise = request("/api/slow");
      const rejectionExpectation = expect(requestPromise).rejects.toThrow(
        "Request timed out for /api/slow after 120000ms requestId req_1700000000000_1dcd6500",
      );
      await vi.advanceTimersByTimeAsync(120_000);
      await rejectionExpectation;
    } finally {
      vi.useRealTimers();
    }
  });

  it("maps caller-initiated aborts to RequestCanceledError", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => {
      return new Promise<Response>((_resolve, reject) => {
        if (init?.signal?.aborted === true) {
          reject(createAbortError());
          return;
        }
        init?.signal?.addEventListener(
          "abort",
          () => {
            reject(createAbortError());
          },
          { once: true },
        );
      });
    });

    const abortController = new AbortController();
    const requestPromise = request("/api/threads", { signal: abortController.signal });
    abortController.abort();

    await expect(requestPromise).rejects.toBeInstanceOf(RequestCanceledError);
  });
});

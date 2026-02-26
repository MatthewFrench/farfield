import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyRequestOptions,
  FarfieldHttpRequestFailureError,
  request,
  requestNoContent
} from "../Source/Shared/Transport/FarfieldHttpTransport";
import { type StructuredDataValue } from "../Source/Shared/Contracts/StructuredDataValue";

function createJsonResponse(body: StructuredDataValue, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function createLargeEnvelope(payloadLength: number): StructuredDataValue {
  return {
    ok: true,
    data: "x".repeat(payloadLength)
  };
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
          "Content-Type": "application/json"
        }
      })
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
          error: "Nope"
        },
        500
      )
    );

    await expect(requestNoContent("/api/no-content")).rejects.toThrow("Nope");
  });

  it("trims and applies action metadata headers while preserving existing headers", () => {
    const abortController = new AbortController();
    const init: RequestInit = {
      headers: {
        "X-Custom": "custom-value"
      }
    };

    const nextInit = applyRequestOptions(init, {
      actionId: "  action_1  ",
      actionName: "  send-message  ",
      signal: abortController.signal
    });
    const nextHeaders = new Headers(nextInit.headers);

    expect(nextHeaders.get("X-Custom")).toBe("custom-value");
    expect(nextHeaders.get("X-Farfield-Action-Id")).toBe("action_1");
    expect(nextHeaders.get("X-Farfield-Action-Name")).toBe("send-message");
    expect(nextInit.signal).toBe(abortController.signal);
  });

  it("rejects blank action metadata values", () => {
    expect(() =>
      applyRequestOptions({}, {
        actionId: "   ",
        actionName: "   "
      })
    ).toThrow("Request metadata values must not be blank");
  });

  it("rejects non-token action metadata values", () => {
    expect(() =>
      applyRequestOptions({}, {
        actionId: "action value",
        actionName: "send message"
      })
    ).toThrow("Request metadata values may contain only letters");
  });

  it("rejects request calls when the path is blank", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        ok: true
      })
    );

    await expect(request("   ")).rejects.toThrow("Request path must not be blank");
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });
});

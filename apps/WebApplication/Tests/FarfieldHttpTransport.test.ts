import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FarfieldHttpRequestFailureError,
  request
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
});

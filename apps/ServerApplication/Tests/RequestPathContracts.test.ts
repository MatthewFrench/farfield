import { describe, expect, it } from "vitest";
import {
  RequestPathnameByName,
  normalizeRequestMethodForRequestMetrics,
  normalizePathnameForRequestMetrics,
  readPathSegmentsFromPathname,
  readPathnameForRequestMetricsFromRequestUrl
} from "../Source/Network/RequestPathContracts.js";

describe("RequestPathContracts", () => {
  it("normalizes pathnames for request metrics from path and absolute url inputs", () => {
    expect(normalizePathnameForRequestMetrics("/api/threads/thread_123?include=events")).toBe(
      "/api/threads/thread_123"
    );
    expect(
      normalizePathnameForRequestMetrics("https://example.test/api/debug/history/entry_1?limit=5#frag")
    ).toBe("/api/debug/history/entry_1");
    expect(normalizePathnameForRequestMetrics("api/debug/client-errors/session-log")).toBe(
      "/api/debug/client-errors/session-log"
    );
    expect(normalizePathnameForRequestMetrics("?query-only=true")).toBe(RequestPathnameByName.root);
  });

  it("reads normalized metrics pathname from incoming request url values", () => {
    expect(readPathnameForRequestMetricsFromRequestUrl(undefined)).toBe(
      RequestPathnameByName.missingRequestUrl
    );
    expect(readPathnameForRequestMetricsFromRequestUrl("/api/events/session?token=abc")).toBe(
      "/api/events/session"
    );
    expect(readPathnameForRequestMetricsFromRequestUrl("http://[invalid")).toBe(
      RequestPathnameByName.malformedRequestUrl
    );
  });

  it("reads stable pathname segments for route matching and classification", () => {
    expect(readPathSegmentsFromPathname("/api/debug/client-errors/session-log?limit=10")).toEqual([
      "api",
      "debug",
      "client-errors",
      "session-log"
    ]);
    expect(readPathSegmentsFromPathname(RequestPathnameByName.root)).toEqual([]);
  });

  it("normalizes request method labels for observability ownership", () => {
    expect(normalizeRequestMethodForRequestMetrics(undefined)).toBe("UNKNOWN");
    expect(normalizeRequestMethodForRequestMetrics("  get  ")).toBe("GET");
    expect(normalizeRequestMethodForRequestMetrics("patch")).toBe("PATCH");
  });
});

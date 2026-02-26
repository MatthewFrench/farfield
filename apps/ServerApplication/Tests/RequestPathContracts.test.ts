import { describe, expect, it } from "vitest";
import {
  RequestPathnameByName,
  RequestUrlPathnameParseStatusByName,
  normalizeRequestMethodForRequestMetrics,
  normalizePathnameForRequestMetrics,
  parseRequestUrlPathname,
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
    expect(normalizePathnameForRequestMetrics("/api/debug/history/entry_1#frag?ignored")).toBe(
      "/api/debug/history/entry_1"
    );
    expect(normalizePathnameForRequestMetrics("/api/debug/history/http://entry_1?limit=5")).toBe(
      "/api/debug/history/http://entry_1"
    );
    expect(normalizePathnameForRequestMetrics("api/debug/client-errors/session-log")).toBe(
      "/api/debug/client-errors/session-log"
    );
    expect(normalizePathnameForRequestMetrics("https://[invalid")).toBe(
      RequestPathnameByName.malformedRequestUrl
    );
  });

  it("normalizes empty, query-only, hash-only, and slash-only values to root", () => {
    expect(normalizePathnameForRequestMetrics("  ")).toBe(RequestPathnameByName.root);
    expect(normalizePathnameForRequestMetrics("?query-only=true")).toBe(RequestPathnameByName.root);
    expect(normalizePathnameForRequestMetrics("#fragment-only")).toBe(RequestPathnameByName.root);
    expect(normalizePathnameForRequestMetrics("////")).toBe(RequestPathnameByName.root);
  });

  it("reads normalized metrics pathname from incoming request url values", () => {
    expect(readPathnameForRequestMetricsFromRequestUrl(undefined)).toBe(
      RequestPathnameByName.missingRequestUrl
    );
    expect(readPathnameForRequestMetricsFromRequestUrl("")).toBe(RequestPathnameByName.root);
    expect(readPathnameForRequestMetricsFromRequestUrl("   ")).toBe(RequestPathnameByName.root);
    expect(readPathnameForRequestMetricsFromRequestUrl("/api/events/session?token=abc")).toBe(
      "/api/events/session"
    );
    expect(readPathnameForRequestMetricsFromRequestUrl("http://[invalid")).toBe(
      RequestPathnameByName.malformedRequestUrl
    );
    expect(readPathnameForRequestMetricsFromRequestUrl("https://[invalid")).toBe(
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
    expect(readPathSegmentsFromPathname("https://[invalid")).toEqual(["malformed-request-url"]);
    expect(readPathSegmentsFromPathname(RequestPathnameByName.root)).toEqual([]);
  });

  it("normalizes request method labels for observability ownership", () => {
    expect(normalizeRequestMethodForRequestMetrics(undefined)).toBe("UNKNOWN");
    expect(normalizeRequestMethodForRequestMetrics("  get  ")).toBe("GET");
    expect(normalizeRequestMethodForRequestMetrics("patch")).toBe("PATCH");
  });

  it("parses request-url pathnames with deterministic resolved and malformed statuses", () => {
    const resolvedResult = parseRequestUrlPathname({
      requestUrl: "/api/events/session?token=abc#fragment",
      host: "localhost",
      port: 4311
    });
    expect(resolvedResult.status).toBe(RequestUrlPathnameParseStatusByName.resolved);
    if (resolvedResult.status !== RequestUrlPathnameParseStatusByName.resolved) {
      throw new Error("Expected parseRequestUrlPathname to resolve a valid relative request URL");
    }
    expect(resolvedResult.pathname).toBe("/api/events/session");
    expect(resolvedResult.pathSegments).toEqual(["api", "events", "session"]);
    expect(resolvedResult.url.pathname).toBe("/api/events/session");

    const rootResolvedResult = parseRequestUrlPathname({
      requestUrl: "?healthy=true",
      host: "localhost",
      port: 4311
    });
    expect(rootResolvedResult.status).toBe(RequestUrlPathnameParseStatusByName.resolved);
    if (rootResolvedResult.status !== RequestUrlPathnameParseStatusByName.resolved) {
      throw new Error("Expected query-only request URL parsing to resolve to the root pathname");
    }
    expect(rootResolvedResult.pathname).toBe(RequestPathnameByName.root);
    expect(rootResolvedResult.pathSegments).toEqual([]);

    const malformedResult = parseRequestUrlPathname({
      requestUrl: "http://[invalid",
      host: "localhost",
      port: 4311
    });
    expect(malformedResult.status).toBe(
      RequestUrlPathnameParseStatusByName.malformedRequestUrl
    );
  });

  it("parses absolute request urls into deterministic normalized route segments", () => {
    const resolvedAbsoluteResult = parseRequestUrlPathname({
      requestUrl: "https://example.test/api/debug/history/entry_1?limit=5#fragment",
      host: "localhost",
      port: 4311
    });
    expect(resolvedAbsoluteResult.status).toBe(RequestUrlPathnameParseStatusByName.resolved);
    if (resolvedAbsoluteResult.status !== RequestUrlPathnameParseStatusByName.resolved) {
      throw new Error("Expected absolute request URL parsing to resolve to a normalized pathname");
    }

    expect(resolvedAbsoluteResult.pathname).toBe("/api/debug/history/entry_1");
    expect(resolvedAbsoluteResult.pathSegments).toEqual([
      "api",
      "debug",
      "history",
      "entry_1"
    ]);
    expect(resolvedAbsoluteResult.url.pathname).toBe("/api/debug/history/entry_1");
  });

  it("rejects malformed parse-input contracts with deterministic malformed status", () => {
    const malformedHostResult = parseRequestUrlPathname({
      requestUrl: "/api/events/session",
      host: "",
      port: 4311
    });
    expect(malformedHostResult.status).toBe(
      RequestUrlPathnameParseStatusByName.malformedRequestUrl
    );

    const malformedPortRangeResult = parseRequestUrlPathname({
      requestUrl: "/api/events/session",
      host: "localhost",
      port: 70_000
    });
    expect(malformedPortRangeResult.status).toBe(
      RequestUrlPathnameParseStatusByName.malformedRequestUrl
    );

    const malformedPortNumberResult = parseRequestUrlPathname({
      requestUrl: "/api/events/session",
      host: "localhost",
      port: Number.NaN
    });
    expect(malformedPortNumberResult.status).toBe(
      RequestUrlPathnameParseStatusByName.malformedRequestUrl
    );
  });
});

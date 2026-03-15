import { describe, expect, it } from "vitest";
import {
  type DebugErrorLike,
  type DebugHistoryEntryLike,
} from "@/Features/Debugging/DomainModel/DebugIssueContracts";
import { DebugIssueStateResolver } from "@/Features/Debugging/DomainModel/DebugIssueStateResolver";

function buildDebugError(input: {
  errorId: string;
  operation: string;
  message: string;
  occurredAt: string;
}): DebugErrorLike {
  return {
    errorId: input.errorId,
    origin: "server",
    source: "farfield-web",
    operation: input.operation,
    message: input.message,
    severity: "error",
    name: "Error",
    stack: null,
    requestId: null,
    threadId: null,
    occurredAt: input.occurredAt,
    details: {},
  };
}

function buildHistoryWarningEntry(input: {
  id: string;
  at: string;
  method: string;
}): DebugHistoryEntryLike {
  return {
    id: input.id,
    at: input.at,
    source: "ipc",
    payload: {},
    meta: {
      method: input.method,
    },
  };
}

describe("DebugIssueStateResolver", () => {
  it("reads and sorts combined debug issues by descending time", () => {
    const resolver = new DebugIssueStateResolver();
    const debugErrorIssues = resolver.readDebugErrorIssues([
      buildDebugError({
        errorId: "error-early",
        operation: "thread.read",
        message: "early error",
        occurredAt: "2025-01-01T10:00:00.000Z",
      }),
      buildDebugError({
        errorId: "error-late",
        operation: "thread.read",
        message: "late error",
        occurredAt: "2025-01-01T11:00:00.000Z",
      }),
    ]);
    const debugWarningIssues = resolver.readDebugWarningIssues([
      buildHistoryWarningEntry({
        id: "warning-1",
        at: "2025-01-01T10:30:00.000Z",
        method: "warning.deprecated.method",
      }),
    ]);

    const debugIssues = resolver.readCombinedDebugIssues({
      debugErrorIssues,
      debugWarningIssues,
    });

    expect(debugIssues.map((issue) => issue.id)).toEqual([
      "error:error-late",
      "warning:history-method:warning-1",
      "error:error-early",
    ]);
  });

  it("filters issues by severity and query text", () => {
    const resolver = new DebugIssueStateResolver();
    const debugIssues = resolver.readCombinedDebugIssues({
      debugErrorIssues: resolver.readDebugErrorIssues([
        buildDebugError({
          errorId: "error-alpha",
          operation: "alpha.operation",
          message: "alpha failure",
          occurredAt: "2025-01-01T10:00:00.000Z",
        }),
      ]),
      debugWarningIssues: resolver.readDebugWarningIssues([
        buildHistoryWarningEntry({
          id: "warning-beta",
          at: "2025-01-01T10:30:00.000Z",
          method: "warning.beta",
        }),
      ]),
    });

    const filteredErrorIssues = resolver.readFilteredDebugIssues({
      debugIssues,
      severityFilter: "error",
      filterQuery: "",
    });
    const filteredWarningIssuesByQuery = resolver.readFilteredDebugIssues({
      debugIssues,
      severityFilter: "all",
      filterQuery: "warning.beta",
    });

    expect(filteredErrorIssues.length).toBe(1);
    expect(filteredErrorIssues[0]?.severity).toBe("error");
    expect(filteredWarningIssuesByQuery.length).toBe(1);
    expect(filteredWarningIssuesByQuery[0]?.severity).toBe("warning");
  });

  it("normalizes filter query casing and surrounding whitespace", () => {
    const resolver = new DebugIssueStateResolver();
    const debugIssues = resolver.readCombinedDebugIssues({
      debugErrorIssues: resolver.readDebugErrorIssues([
        buildDebugError({
          errorId: "error-alpha",
          operation: "alpha.operation",
          message: "alpha failure",
          occurredAt: "2025-01-01T10:00:00.000Z",
        }),
      ]),
      debugWarningIssues: resolver.readDebugWarningIssues([
        buildHistoryWarningEntry({
          id: "warning-beta",
          at: "2025-01-01T10:30:00.000Z",
          method: "warning.beta",
        }),
      ]),
    });

    const filteredIssues = resolver.readFilteredDebugIssues({
      debugIssues,
      severityFilter: "all",
      filterQuery: "   ALPHA FAILURE   ",
    });

    expect(filteredIssues.map((issue) => issue.id)).toEqual(["error:error-alpha"]);
  });

  it("resolves selected issue and next selected identifier", () => {
    const resolver = new DebugIssueStateResolver();
    const debugIssues = resolver.readCombinedDebugIssues({
      debugErrorIssues: resolver.readDebugErrorIssues([
        buildDebugError({
          errorId: "error-first",
          operation: "alpha.operation",
          message: "alpha failure",
          occurredAt: "2025-01-01T10:00:00.000Z",
        }),
      ]),
      debugWarningIssues: [],
    });

    const selectedDebugIssue = resolver.readSelectedDebugIssue({
      debugIssues,
      selectedIssueIdentifier: "error:error-first",
    });
    const nextSelectedDebugIssueIdentifierWhenMissing =
      resolver.readNextSelectedDebugIssueIdentifier({
        debugIssues,
        selectedIssueIdentifier: "missing",
      });
    const nextSelectedDebugIssueIdentifierWhenEmpty = resolver.readNextSelectedDebugIssueIdentifier(
      {
        debugIssues: [],
        selectedIssueIdentifier: "missing",
      },
    );

    expect(selectedDebugIssue?.id).toBe("error:error-first");
    expect(nextSelectedDebugIssueIdentifierWhenMissing).toBe("error:error-first");
    expect(nextSelectedDebugIssueIdentifierWhenEmpty).toBe("");
  });

  it("derives runtime-request-error operation counts from action names and request paths", () => {
    const resolver = new DebugIssueStateResolver();
    const runtimeRequestErrorMetrics = resolver.readRuntimeRequestErrorOperationMetrics([
      {
        ...buildDebugError({
          errorId: "runtime-1",
          operation: "runtime-request-error",
          message: "Request failed for /api/threads",
          occurredAt: "2025-01-01T12:00:00.000Z",
        }),
        details: {
          actionName: "startup-critical.threads.active",
        },
      },
      {
        ...buildDebugError({
          errorId: "runtime-2",
          operation: "runtime-request-error",
          message: "Request failed for /api/threads",
          occurredAt: "2025-01-01T12:01:00.000Z",
        }),
        details: {},
      },
      {
        ...buildDebugError({
          errorId: "runtime-3",
          operation: "runtime-request-error",
          message: "Request failed for /api/threads",
          occurredAt: "2025-01-01T12:02:00.000Z",
        }),
        details: {},
      },
      buildDebugError({
        errorId: "runtime-ignored",
        operation: "thread.read",
        message: "Read failed",
        occurredAt: "2025-01-01T12:03:00.000Z",
      }),
    ]);

    expect(runtimeRequestErrorMetrics).toEqual([
      {
        operation: "request-path:/api/threads",
        count: 2,
      },
      {
        operation: "startup-critical.threads.active",
        count: 1,
      },
    ]);
  });
});

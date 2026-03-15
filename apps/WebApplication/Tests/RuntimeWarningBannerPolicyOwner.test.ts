import { describe, expect, it } from "vitest";
import { type RuntimeWarningEvent } from "../Source/Application/StateManagement/RuntimeNotificationProjectionParser";
import { RuntimeWarningBannerPolicyOwner } from "../Source/Application/StateManagement/RuntimeWarningBannerPolicyOwner";
import { type ThreadRuntimeWarningSummary } from "../Source/Features/Threads/DomainModel/ThreadRuntimeStatusContracts";

function createWarningSummary(
  input?: Partial<ThreadRuntimeWarningSummary>,
): ThreadRuntimeWarningSummary {
  return {
    method: input?.method ?? "configWarning",
    severity: input?.severity ?? "warning",
    summary: input?.summary ?? "Config warning",
    threadId: input?.threadId ?? "thread-1",
    isRetrying: input?.isRetrying ?? false,
    sequence: input?.sequence ?? 50,
    receivedAtMilliseconds: input?.receivedAtMilliseconds ?? 1_000,
    refreshedAtMilliseconds: input?.refreshedAtMilliseconds ?? 1_500,
  };
}

function createWarningEvent(input?: Partial<RuntimeWarningEvent>): RuntimeWarningEvent {
  return {
    method: input?.method ?? "configWarning",
    severity: input?.severity ?? "warning",
    summary: input?.summary ?? "Config warning",
    threadId: input?.threadId === undefined ? "thread-1" : input.threadId,
    isRetrying: input?.isRetrying ?? false,
    sequence: input?.sequence ?? 60,
    receivedAtMilliseconds: input?.receivedAtMilliseconds ?? 2_000,
  };
}

describe("RuntimeWarningBannerPolicyOwner", () => {
  it("keeps higher-priority error warnings when lower-priority info arrives", () => {
    const owner = new RuntimeWarningBannerPolicyOwner(() => 20_000);
    owner.resetSelectedThread("thread-1");

    const previousSummary = createWarningSummary({
      method: "error",
      severity: "error",
      summary: "Turn failed",
      refreshedAtMilliseconds: 19_900,
    });
    const latestWarningEvent = createWarningEvent({
      method: "serverRequest/resolved",
      severity: "info",
      summary: "Server request #44 resolved",
      threadId: "thread-1",
      receivedAtMilliseconds: 19_950,
    });

    const result = owner.readNextWarningSummary({
      previousSummary,
      latestWarningEvent,
      resetRequired: false,
    });

    expect(result).toBe(previousSummary);
  });

  it("dedupes equivalent warnings inside the dedupe window", () => {
    const owner = new RuntimeWarningBannerPolicyOwner(() => 12_000);
    owner.resetSelectedThread("thread-1");

    const previousSummary = createWarningSummary({
      method: "thread/closed",
      severity: "warning",
      summary: "Thread closed",
      threadId: "thread-1",
      receivedAtMilliseconds: 10_000,
      refreshedAtMilliseconds: 11_900,
    });
    const latestWarningEvent = createWarningEvent({
      method: "thread/closed",
      severity: "warning",
      summary: "Thread closed",
      threadId: "thread-1",
      receivedAtMilliseconds: 11_200,
    });

    const result = owner.readNextWarningSummary({
      previousSummary,
      latestWarningEvent,
      resetRequired: false,
    });

    expect(result).toBe(previousSummary);
  });

  it("expires warning summaries after time-to-live when no new warning arrives", () => {
    const owner = new RuntimeWarningBannerPolicyOwner(() => 40_000);
    owner.resetSelectedThread("thread-1");

    const previousSummary = createWarningSummary({
      method: "error",
      severity: "error",
      summary: "Turn failed",
      refreshedAtMilliseconds: 10_000,
    });

    const result = owner.readNextWarningSummary({
      previousSummary,
      latestWarningEvent: null,
      resetRequired: false,
    });

    expect(result).toBeNull();
  });

  it("adopts a higher-priority warning when one arrives", () => {
    const owner = new RuntimeWarningBannerPolicyOwner(() => 30_000);
    owner.resetSelectedThread("thread-1");

    const previousSummary = createWarningSummary({
      method: "mcpServer/oauthLogin/completed",
      severity: "success",
      summary: "MCP OAuth connected (github)",
      threadId: null,
      refreshedAtMilliseconds: 29_000,
    });
    const latestWarningEvent = createWarningEvent({
      method: "configWarning",
      severity: "warning",
      summary: "Config file has an unknown key",
      threadId: null,
      receivedAtMilliseconds: 29_500,
    });

    const result = owner.readNextWarningSummary({
      previousSummary,
      latestWarningEvent,
      resetRequired: false,
    });

    expect(result).toEqual({
      method: "configWarning",
      severity: "warning",
      summary: "Config file has an unknown key",
      threadId: null,
      isRetrying: false,
      sequence: 60,
      receivedAtMilliseconds: 29_500,
      refreshedAtMilliseconds: expect.any(Number),
    });
  });

  it("signals warning clear requirements when selected thread changes", () => {
    const owner = new RuntimeWarningBannerPolicyOwner(() => 5_000);
    owner.resetSelectedThread("thread-1");

    expect(owner.readThreadSwitchRequiresWarningClear("thread-1")).toBe(false);
    expect(owner.readThreadSwitchRequiresWarningClear("thread-2")).toBe(true);
    expect(owner.readThreadSwitchRequiresWarningClear("thread-2")).toBe(false);
  });
});

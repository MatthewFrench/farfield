import { describe, expect, it } from "vitest";
import { readThreadListState } from "../Source/Application/StateManagement/ApplicationThreadAndChatSurfaceDerivation";

describe("ApplicationThreadAndChatSurfaceDerivation", () => {
  it("keeps the thread list ready while cached rows remain visible during background core refresh", () => {
    expect(
      readThreadListState({
        isCoreLoading: true,
        threadCount: 3,
      }),
    ).toBe("ready");
  });

  it("reports loading only when core refresh is running and the list is empty", () => {
    expect(
      readThreadListState({
        isCoreLoading: true,
        threadCount: 0,
      }),
    ).toBe("loading");
  });

  it("reports empty when refresh is idle and there are no threads", () => {
    expect(
      readThreadListState({
        isCoreLoading: false,
        threadCount: 0,
      }),
    ).toBe("empty");
  });
});

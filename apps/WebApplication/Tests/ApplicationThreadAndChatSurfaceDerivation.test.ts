import { describe, expect, it } from "vitest";
import {
  readSelectedThreadLabel,
  readThreadListState,
} from "../Source/Application/StateManagement/ApplicationThreadAndChatSurfaceDerivation";

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

  it("keeps a selected thread label in loading state while the thread list has not materialized it yet", () => {
    expect(
      readSelectedThreadLabel({
        selectedThread: null,
        selectedThreadId: "thread-1",
        isSelectedThreadLoading: false,
      }),
    ).toBe("Loading thread...");
  });
});

import { cleanup, render } from "@testing-library/react";
import {
  afterEach,
  describe,
  expect,
  it
} from "vitest";
import { UNSUPPORTED_PUSH_CLIENT_STATE } from "../Source/Application/Configuration/ApplicationBehaviorConfiguration";
import {
  useApplicationShellState,
  type ApplicationShellState
} from "../Source/Application/StateManagement/UseApplicationShellState";

interface HarnessProperties {
  onState: (state: ApplicationShellState) => void;
}

function Harness(properties: HarnessProperties): React.JSX.Element {
  const state = useApplicationShellState({
    initialUiState: {
      threadId: "thread-123",
      tab: "debug"
    },
    unsupportedPushClientState: UNSUPPORTED_PUSH_CLIENT_STATE,
    initialVisibleChatItems: 50
  });
  properties.onState(state);
  return <div data-testid="application-shell-state-harness" />;
}

describe("useApplicationShellState", () => {
  afterEach(() => {
    cleanup();
  });

  it("initializes selected-thread and tab refs from initial route state", () => {
    const capturedState: { current: ApplicationShellState | null } = {
      current: null
    };

    render(<Harness onState={(state) => {
      capturedState.current = state;
    }} />);

    if (!capturedState.current) {
      throw new Error("Expected application shell state to be captured");
    }

    const applicationShellState = capturedState.current;
    expect(applicationShellState.selectedThreadId).toBe("thread-123");
    expect(applicationShellState.selectedThreadIdRef.current).toBe("thread-123");
    expect(applicationShellState.activeTab).toBe("debug");
    expect(applicationShellState.activeTabRef.current).toBe("debug");
  });
});

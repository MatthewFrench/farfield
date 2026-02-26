import { cleanup, render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { type ErrorBannerDetails } from "@/Features/Debugging/DomainModel/DebugIssueContracts";
import { buildDebugErrorIssueIdentifier } from "@/Features/Debugging/DomainModel/DebugIssueIdentifier";
import { type DebugWorkspaceSection } from "@/Features/Debugging/DomainModel/DebugWorkspaceSectionContracts";
import { DebugServerClient } from "@/Features/Debugging/DataAccess/DebugServerClient";
import {
  type DebugActionHandlers,
  type UseDebugActionHandlersInput,
  useDebugActionHandlers
} from "@/Features/Debugging/StateManagement/UseDebugActionHandlers";
import { DebugWorkspaceActionCoordinator } from "@/Features/Debugging/StateManagement/DebugWorkspaceActionCoordinator";

interface HandlerHarnessProps {
  input: UseDebugActionHandlersInput;
  onHandlersReady: (handlers: DebugActionHandlers) => void;
}

type ActiveTabSetterValue = "chat" | "debug" | ((previousValue: "chat" | "debug") => "chat" | "debug");
type DebugWorkspaceSectionSetterValue = DebugWorkspaceSection | ((previousValue: DebugWorkspaceSection) => DebugWorkspaceSection);
type DebugIssueSeverityFilterSetterValue = "all" | "error" | "warning" | ((previousValue: "all" | "error" | "warning") => "all" | "error" | "warning");
type StringSetterValue = string | ((previousValue: string) => string);

function HandlerHarness({ input, onHandlersReady }: HandlerHarnessProps): React.JSX.Element {
  const handlers = useDebugActionHandlers(input);

  useEffect(() => {
    onHandlersReady(handlers);
  }, [handlers, onHandlersReady]);

  return <></>;
}

function buildTestInput(errorBannerDetails: ErrorBannerDetails) {
  const setActiveTab = vi.fn<(value: ActiveTabSetterValue) => void>();
  const setDebugWorkspaceSection = vi.fn<(value: DebugWorkspaceSectionSetterValue) => void>();
  const setDebugIssueSeverityFilter = vi.fn<(value: DebugIssueSeverityFilterSetterValue) => void>();
  const setSelectedDebugIssueId = vi.fn<(value: StringSetterValue) => void>();
  const setDebugIssueFilterQuery = vi.fn<(value: StringSetterValue) => void>();

  const input: UseDebugActionHandlersInput = {
    debugWorkspaceActionCoordinator: new DebugWorkspaceActionCoordinator(),
    debugServerClient: new DebugServerClient(),
    refreshCoreData: async () => {},
    traceLabel: "",
    traceNote: "",
    errorBannerDetails,
    setActiveTab,
    setDebugWorkspaceSection,
    setDebugIssueSeverityFilter,
    setSelectedDebugIssueId,
    setDebugIssueFilterQuery,
    onHistoryDetailLoaded: () => {}
  };

  return {
    input,
    setActiveTab,
    setDebugWorkspaceSection,
    setDebugIssueSeverityFilter,
    setSelectedDebugIssueId,
    setDebugIssueFilterQuery
  };
}

describe("UseDebugActionHandlers", () => {
  it("opens debug tab and selects debug error by error identifier", async () => {
    cleanup();
    const {
      input,
      setActiveTab,
      setDebugWorkspaceSection,
      setDebugIssueSeverityFilter,
      setSelectedDebugIssueId,
      setDebugIssueFilterQuery
    } = buildTestInput({
      operation: "thread.read",
      message: "failed",
      actionId: "action-1",
      requestId: "request-1",
      errorId: "error-1"
    });

    const handlerState: { current: DebugActionHandlers | null } = { current: null };
    render(
      <HandlerHarness
        input={input}
        onHandlersReady={(nextHandlers) => {
          handlerState.current = nextHandlers;
        }}
      />
    );

    await waitFor(() => {
      expect(handlerState.current).not.toBeNull();
    });

    const handlers = handlerState.current;
    if (handlers === null) {
      throw new Error("expected handlers to be ready");
    }
    handlers.openDebugFromErrorBanner();

    expect(setActiveTab).toHaveBeenCalledWith("debug");
    expect(setDebugWorkspaceSection).toHaveBeenCalledWith("issues");
    expect(setDebugIssueSeverityFilter).toHaveBeenCalledWith("all");
    expect(setSelectedDebugIssueId).toHaveBeenCalledWith(
      buildDebugErrorIssueIdentifier("error-1")
    );
    expect(setDebugIssueFilterQuery).toHaveBeenCalledWith("error-1");
  });

  it("uses request and action context when no debug error identifier is present", async () => {
    cleanup();
    const {
      input,
      setSelectedDebugIssueId,
      setDebugIssueFilterQuery
    } = buildTestInput({
      operation: "thread.read",
      message: "failed",
      actionId: "action-11",
      requestId: "request-11",
      errorId: null
    });

    const handlerState: { current: DebugActionHandlers | null } = { current: null };
    render(
      <HandlerHarness
        input={input}
        onHandlersReady={(nextHandlers) => {
          handlerState.current = nextHandlers;
        }}
      />
    );

    await waitFor(() => {
      expect(handlerState.current).not.toBeNull();
    });

    const handlers = handlerState.current;
    if (handlers === null) {
      throw new Error("expected handlers to be ready");
    }
    handlers.openDebugFromErrorBanner();

    expect(setSelectedDebugIssueId).not.toHaveBeenCalled();
    expect(setDebugIssueFilterQuery).toHaveBeenCalledWith("request-11");
  });
});

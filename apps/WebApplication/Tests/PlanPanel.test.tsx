import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlanPanel, type PlanPanelProps } from "@/Components/PlanPanel";

const basePlanPanelProperties: PlanPanelProps = {
  modes: [
    { mode: "default", name: "Default" },
    { mode: "plan", name: "Plan" }
  ],
  modelOptions: [
    { id: "gpt-5.3-codex", label: "GPT-5.3 Codex" }
  ],
  effortOptions: ["low", "high"],
  selectedModeKey: "default",
  selectedModelId: "",
  selectedReasoningEffort: "",
  onModeChange: () => {},
  onModelChange: () => {},
  onEffortChange: () => {},
  onApply: () => {},
  isBusy: false,
  hasThread: true,
  hasMode: true
};

function renderPlanPanel(properties?: Partial<PlanPanelProps>): void {
  cleanup();

  render(
    <PlanPanel
      {...basePlanPanelProperties}
      {...properties}
    />
  );
}

describe("PlanPanel", () => {
  it("shows explicit app-default labels for empty model and effort selections", () => {
    renderPlanPanel({
      selectedModelId: "",
      selectedReasoningEffort: ""
    });

    const appDefaultLabels = screen.getAllByText("App default");

    expect(appDefaultLabels.length).toBeGreaterThanOrEqual(2);
  });

  it("disables apply when thread or mode context is unavailable", () => {
    renderPlanPanel({
      hasThread: false,
      hasMode: false
    });

    expect(screen.getByRole("button", { name: "Apply" }).hasAttribute("disabled")).toBe(true);
  });

  it("calls apply when all contract preconditions are satisfied", () => {
    const onApply = vi.fn();

    renderPlanPanel({
      onApply,
      hasThread: true,
      hasMode: true,
      isBusy: false
    });

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(onApply).toHaveBeenCalledTimes(1);
  });
});

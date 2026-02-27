import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "@/Components/UserInterface/Badge";
import { Button } from "@/Components/UserInterface/Button";
import { Card } from "@/Components/UserInterface/Card";
import { Checkbox } from "@/Components/UserInterface/Checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/Components/UserInterface/DropdownMenu";
import { Input } from "@/Components/UserInterface/Input";
import { Label } from "@/Components/UserInterface/Label";
import { RadioGroup, RadioGroupItem } from "@/Components/UserInterface/RadioGroup";
import { ScrollArea } from "@/Components/UserInterface/ScrollArea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/Components/UserInterface/Select";
import { Tabs } from "@/Components/UserInterface/Tabs";
import { TabsContent } from "@/Components/UserInterface/TabsContent";
import { TabsList } from "@/Components/UserInterface/TabsList";
import { TabsTrigger } from "@/Components/UserInterface/TabsTrigger";
import { Textarea } from "@/Components/UserInterface/Textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/Components/UserInterface/Tooltip";

function renderSelectTrigger(input?: { size?: "default" | "sm" }): void {
  const selectTriggerSizeProperties = input?.size === undefined ? {} : { size: input.size };

  cleanup();
  render(
    <Select>
      <SelectTrigger data-testid="select-trigger" {...selectTriggerSizeProperties}>
        <SelectValue placeholder="Select value" />
      </SelectTrigger>
    </Select>,
  );
}

function renderDropdownMenuItem(input?: { variant?: "default" | "destructive" }): void {
  const dropdownMenuVariantProperties =
    input?.variant === undefined ? {} : { variant: input.variant };

  cleanup();
  render(
    <DropdownMenu open>
      <DropdownMenuTrigger>Open</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem data-testid="dropdown-menu-item" {...dropdownMenuVariantProperties}>
          Item label
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>,
  );
}

describe("UserInterfacePrimitiveContracts", () => {
  it("applies the default select trigger size token when size is omitted", () => {
    renderSelectTrigger();
    expect(screen.getByTestId("select-trigger").getAttribute("data-size")).toBe("default");
  });

  it("applies the provided select trigger size token", () => {
    renderSelectTrigger({ size: "sm" });
    expect(screen.getByTestId("select-trigger").getAttribute("data-size")).toBe("sm");
  });

  it("applies the default dropdown item variant token when variant is omitted", () => {
    renderDropdownMenuItem();
    expect(screen.getByTestId("dropdown-menu-item").getAttribute("data-variant")).toBe("default");
  });

  it("applies the provided dropdown item variant token", () => {
    renderDropdownMenuItem({ variant: "destructive" });
    expect(screen.getByTestId("dropdown-menu-item").getAttribute("data-variant")).toBe(
      "destructive",
    );
  });

  it("uses explicit owner display names for primitive wrappers", () => {
    expect(Badge.displayName).toBe("Badge");
    expect(Button.displayName).toBe("Button");
    expect(Card.displayName).toBe("Card");
    expect(Checkbox.displayName).toBe("Checkbox");
    expect(Input.displayName).toBe("Input");
    expect(Label.displayName).toBe("Label");
    expect(RadioGroup.displayName).toBe("RadioGroup");
    expect(RadioGroupItem.displayName).toBe("RadioGroupItem");
    expect(ScrollArea.displayName).toBe("ScrollArea");
    expect(Tabs.displayName).toBe("Tabs");
    expect(TabsContent.displayName).toBe("TabsContent");
    expect(TabsList.displayName).toBe("TabsList");
    expect(TabsTrigger.displayName).toBe("TabsTrigger");
    expect(Textarea.displayName).toBe("Textarea");
  });

  it("uses explicit owner display names for select, dropdown, and tooltip wrappers", () => {
    expect(Select.displayName).toBe("Select");
    expect(SelectContent.displayName).toBe("SelectContent");
    expect(SelectGroup.displayName).toBe("SelectGroup");
    expect(SelectItem.displayName).toBe("SelectItem");
    expect(SelectLabel.displayName).toBe("SelectLabel");
    expect(SelectScrollDownButton.displayName).toBe("SelectScrollDownButton");
    expect(SelectScrollUpButton.displayName).toBe("SelectScrollUpButton");
    expect(SelectSeparator.displayName).toBe("SelectSeparator");
    expect(SelectTrigger.displayName).toBe("SelectTrigger");
    expect(SelectValue.displayName).toBe("SelectValue");

    expect(DropdownMenu.displayName).toBe("DropdownMenu");
    expect(DropdownMenuCheckboxItem.displayName).toBe("DropdownMenuCheckboxItem");
    expect(DropdownMenuContent.displayName).toBe("DropdownMenuContent");
    expect(DropdownMenuGroup.displayName).toBe("DropdownMenuGroup");
    expect(DropdownMenuItem.displayName).toBe("DropdownMenuItem");
    expect(DropdownMenuLabel.displayName).toBe("DropdownMenuLabel");
    expect(DropdownMenuPortal.displayName).toBe("DropdownMenuPortal");
    expect(DropdownMenuRadioGroup.displayName).toBe("DropdownMenuRadioGroup");
    expect(DropdownMenuRadioItem.displayName).toBe("DropdownMenuRadioItem");
    expect(DropdownMenuSeparator.displayName).toBe("DropdownMenuSeparator");
    expect(DropdownMenuShortcut.displayName).toBe("DropdownMenuShortcut");
    expect(DropdownMenuSub.displayName).toBe("DropdownMenuSub");
    expect(DropdownMenuSubContent.displayName).toBe("DropdownMenuSubContent");
    expect(DropdownMenuSubTrigger.displayName).toBe("DropdownMenuSubTrigger");
    expect(DropdownMenuTrigger.displayName).toBe("DropdownMenuTrigger");

    expect(Tooltip.displayName).toBe("Tooltip");
    expect(TooltipContent.displayName).toBe("TooltipContent");
    expect(TooltipProvider.displayName).toBe("TooltipProvider");
    expect(TooltipTrigger.displayName).toBe("TooltipTrigger");
  });

  it("applies deterministic default contracts for button and input types", () => {
    cleanup();
    render(
      <div>
        <Button>Run</Button>
        <Input data-testid="primitive-default-input" />
      </div>,
    );

    expect(screen.getByRole("button", { name: "Run" }).getAttribute("type")).toBe("button");
    expect(screen.getByTestId("primitive-default-input").getAttribute("type")).toBe("text");
  });

  it("retains base wrapper class contracts for badge, card, and textarea", () => {
    cleanup();
    render(
      <div>
        <Badge data-testid="primitive-badge" variant="success">
          Ready
        </Badge>
        <Card data-testid="primitive-card">Card body</Card>
        <Textarea data-testid="primitive-textarea" />
      </div>,
    );

    expect(screen.getByTestId("primitive-badge").className.includes("bg-emerald-50")).toBe(true);
    expect(screen.getByTestId("primitive-card").className.includes("border-border")).toBe(true);
    expect(screen.getByTestId("primitive-textarea").className.includes("min-h-[60px]")).toBe(true);
  });
});

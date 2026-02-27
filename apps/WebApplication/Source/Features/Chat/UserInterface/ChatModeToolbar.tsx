import { Circle, CircleDot, Loader2 } from "lucide-react";
import { Button } from "@/Components/UserInterface/Button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/Components/UserInterface/Select";

interface ModeOption {
  id: string;
  label: string;
}

const MODEL_PLACEHOLDER_TEXT = "Model";
const EFFORT_PLACEHOLDER_TEXT = "Effort";
const PLAN_LABEL_TEXT = "Plan";
const EMPTY_MODE_KEY = "";

function readSelectedOptionValue(value: string, appDefaultValue: string): string {
  return value.length > 0 ? value : appDefaultValue;
}

function readModeSettingValue(nextValue: string, appDefaultValue: string): string {
  return nextValue === appDefaultValue ? "" : nextValue;
}

export interface ChatModeToolbarProps {
  canSetCollaborationMode: boolean;
  canListCollaborationModes: boolean;
  canListModels: boolean;
  hasPlanModeOption: boolean;
  isPlanModeEnabled: boolean;
  selectedThreadId: string | null;
  appDefaultValue: string;
  appDefaultModel: string;
  appDefaultReasoningEffort: string;
  selectedModelId: string;
  selectedReasoningEffort: string;
  selectedModeKey: string;
  modelOptionsWithoutAssumedDefault: ModeOption[];
  effortOptionsWithoutAssumedDefault: string[];
  isModeSyncing: boolean;
  pendingRequestCount: number;
  onTogglePlanMode: () => void;
  onModelChange: (nextModelId: string) => void;
  onReasoningEffortChange: (nextReasoningEffort: string) => void;
}

export function ChatModeToolbar({
  canSetCollaborationMode,
  canListCollaborationModes,
  canListModels,
  hasPlanModeOption,
  isPlanModeEnabled,
  selectedThreadId,
  appDefaultValue,
  appDefaultModel,
  appDefaultReasoningEffort,
  selectedModelId,
  selectedReasoningEffort,
  selectedModeKey,
  modelOptionsWithoutAssumedDefault,
  effortOptionsWithoutAssumedDefault,
  isModeSyncing,
  pendingRequestCount,
  onTogglePlanMode,
  onModelChange,
  onReasoningEffortChange,
}: ChatModeToolbarProps): React.JSX.Element {
  const shouldShowPlanModeControl = canSetCollaborationMode && canListCollaborationModes;
  const shouldShowModelControl = canSetCollaborationMode && canListModels;
  const shouldShowReasoningEffortControl = canSetCollaborationMode && canListCollaborationModes;
  const isThreadSelected = selectedThreadId !== null;
  const hasSelectedMode = selectedModeKey !== EMPTY_MODE_KEY;
  const areModeSettingControlsDisabled = !isThreadSelected || !hasSelectedMode;

  return (
    <div
      data-testid="chat-mode-toolbar"
      className="flex items-center gap-1 min-w-0 overflow-x-auto overflow-y-hidden whitespace-nowrap"
    >
      {shouldShowPlanModeControl && (
        <Button
          type="button"
          data-testid="chat-mode-toolbar-plan-button"
          onClick={onTogglePlanMode}
          variant="ghost"
          size="sm"
          className={`h-8 shrink-0 rounded-full px-2 text-xs ${
            isPlanModeEnabled
              ? "bg-blue-500/15 text-blue-600 hover:bg-blue-500/20 dark:text-blue-300"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
          }`}
          disabled={!isThreadSelected || !hasPlanModeOption}
        >
          {isPlanModeEnabled ? <CircleDot size={10} /> : <Circle size={10} />}
          {PLAN_LABEL_TEXT}
        </Button>
      )}
      {shouldShowModelControl && (
        <Select
          value={readSelectedOptionValue(selectedModelId, appDefaultValue)}
          onValueChange={(value) => {
            const nextModelId = readModeSettingValue(value, appDefaultValue);
            onModelChange(nextModelId);
          }}
          disabled={areModeSettingControlsDisabled}
        >
          <SelectTrigger
            data-testid="chat-mode-toolbar-model-select"
            className="h-8 w-[132px] sm:w-[176px] shrink-0 rounded-full border-0 bg-transparent dark:bg-transparent px-2 text-xs text-muted-foreground shadow-none hover:text-foreground focus-visible:ring-0"
          >
            <SelectValue placeholder={MODEL_PLACEHOLDER_TEXT} />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value={appDefaultValue}>{appDefaultModel}</SelectItem>
            {modelOptionsWithoutAssumedDefault.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {shouldShowReasoningEffortControl && (
        <Select
          value={readSelectedOptionValue(selectedReasoningEffort, appDefaultValue)}
          onValueChange={(value) => {
            const nextReasoningEffort = readModeSettingValue(value, appDefaultValue);
            onReasoningEffortChange(nextReasoningEffort);
          }}
          disabled={areModeSettingControlsDisabled}
        >
          <SelectTrigger
            data-testid="chat-mode-toolbar-reasoning-effort-select"
            className="h-8 w-[104px] sm:w-[148px] shrink-0 rounded-full border-0 bg-transparent dark:bg-transparent px-2 text-xs text-muted-foreground shadow-none hover:text-foreground focus-visible:ring-0"
          >
            <SelectValue placeholder={EFFORT_PLACEHOLDER_TEXT} />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value={appDefaultValue}>{appDefaultReasoningEffort}</SelectItem>
            {effortOptionsWithoutAssumedDefault.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {canSetCollaborationMode && (
        <span
          data-testid="chat-mode-toolbar-mode-syncing"
          className={`inline-flex w-3 items-center justify-center text-xs text-muted-foreground transition-opacity ${
            isModeSyncing ? "opacity-100" : "opacity-0"
          }`}
        >
          <Loader2 size={10} className={isModeSyncing ? "animate-spin" : ""} />
        </span>
      )}
      {pendingRequestCount > 0 && (
        <span
          data-testid="chat-mode-toolbar-pending-count"
          className="shrink-0 text-xs text-amber-500 dark:text-amber-400"
        >
          {pendingRequestCount} pending
        </span>
      )}
    </div>
  );
}

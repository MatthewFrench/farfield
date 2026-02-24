import { Circle, CircleDot, Loader2 } from "lucide-react";
import { Button } from "@/Components/UserInterface/Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/Components/UserInterface/Select";

interface ModeOption {
  id: string;
  label: string;
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
  onReasoningEffortChange
}: ChatModeToolbarProps): React.JSX.Element {
  return (
    <div
      data-testid="chat-mode-toolbar"
      className="flex items-center gap-1 min-w-0 overflow-x-auto overflow-y-hidden whitespace-nowrap"
    >
      {canSetCollaborationMode && canListCollaborationModes && (
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
          disabled={!selectedThreadId || !hasPlanModeOption}
        >
          {isPlanModeEnabled ? <CircleDot size={10} /> : <Circle size={10} />}
          Plan
        </Button>
      )}
      {canSetCollaborationMode && canListModels && (
        <Select
          value={selectedModelId || appDefaultValue}
          onValueChange={(value) => {
            const nextModelId = value === appDefaultValue ? "" : value;
            onModelChange(nextModelId);
          }}
          disabled={!selectedThreadId || !selectedModeKey}
        >
          <SelectTrigger
            data-testid="chat-mode-toolbar-model-select"
            className="h-8 w-[132px] sm:w-[176px] shrink-0 rounded-full border-0 bg-transparent dark:bg-transparent px-2 text-xs text-muted-foreground shadow-none hover:text-foreground focus-visible:ring-0"
          >
            <SelectValue placeholder="Model" />
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
      {canSetCollaborationMode && canListCollaborationModes && (
        <Select
          value={selectedReasoningEffort || appDefaultValue}
          onValueChange={(value) => {
            const nextReasoningEffort = value === appDefaultValue ? "" : value;
            onReasoningEffortChange(nextReasoningEffort);
          }}
          disabled={!selectedThreadId || !selectedModeKey}
        >
          <SelectTrigger
            data-testid="chat-mode-toolbar-reasoning-effort-select"
            className="h-8 w-[104px] sm:w-[148px] shrink-0 rounded-full border-0 bg-transparent dark:bg-transparent px-2 text-xs text-muted-foreground shadow-none hover:text-foreground focus-visible:ring-0"
          >
            <SelectValue placeholder="Effort" />
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

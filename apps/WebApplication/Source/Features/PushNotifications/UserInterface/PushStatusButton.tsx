import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { type PushClientState } from "@/Features/PushNotifications/DomainModel/PushClientContracts";
import { Button } from "@/Components/UserInterface/Button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/Components/UserInterface/Tooltip";

interface PushStatusButtonProps {
  pushClientState: PushClientState;
  isEnablingPushNotifications: boolean;
  onEnablePushNotifications: () => void;
}

type PushStatusKind = "ready" | "enabling" | "enabled" | "blocked";

interface PushStatusViewState {
  kind: PushStatusKind;
  label: string;
  description: string;
  canEnable: boolean;
}

function readPushStatusViewState(input: {
  pushClientState: PushClientState;
  isEnablingPushNotifications: boolean;
}): PushStatusViewState {
  if (input.isEnablingPushNotifications) {
    return {
      kind: "enabling",
      label: "Enabling",
      description: "Enabling notifications",
      canEnable: false
    };
  }

  if (input.pushClientState.subscribed) {
    return {
      kind: "enabled",
      label: "Enabled",
      description: "Notifications enabled",
      canEnable: false
    };
  }

  if (input.pushClientState.permission === "denied") {
    return {
      kind: "blocked",
      label: "Blocked",
      description: "Notifications blocked by browser settings",
      canEnable: false
    };
  }

  return {
    kind: "ready",
    label: "Enable",
    description: "Enable notifications",
    canEnable: true
  };
}

export function PushStatusButton({
  pushClientState,
  isEnablingPushNotifications,
  onEnablePushNotifications
}: PushStatusButtonProps): React.JSX.Element | null {
  if (!pushClientState.supported) {
    return null;
  }

  const statusViewState = readPushStatusViewState({
    pushClientState,
    isEnablingPushNotifications
  });
  const isDisabled = !statusViewState.canEnable;

  const iconNode = statusViewState.kind === "enabling"
    ? <Loader2 size={14} className="animate-spin" />
    : statusViewState.kind === "enabled"
      ? <BellRing size={14} />
      : statusViewState.kind === "blocked"
        ? <BellOff size={14} />
        : <Bell size={14} />;

  const buttonNode = (
    <Button
      type="button"
      onClick={onEnablePushNotifications}
      disabled={isDisabled}
      data-testid="enable-notifications-button"
      data-push-status={statusViewState.kind}
      aria-label={statusViewState.description}
      title={statusViewState.description}
      variant="ghost"
      size="sm"
      className={`h-8 rounded-lg px-2 gap-1.5 ${
        statusViewState.kind === "enabled"
          ? "bg-muted text-foreground hover:bg-muted"
          : statusViewState.kind === "blocked"
            ? "text-amber-700 hover:text-amber-700 hover:bg-amber-100/60 dark:text-amber-300 dark:hover:bg-amber-500/15"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      {iconNode}
      <span className="hidden lg:inline text-[11px] leading-none">{statusViewState.label}</span>
    </Button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{buttonNode}</TooltipTrigger>
      <TooltipContent>{statusViewState.description}</TooltipContent>
    </Tooltip>
  );
}

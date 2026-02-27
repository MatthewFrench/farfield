import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { Button } from "@/Components/UserInterface/Button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/Components/UserInterface/Tooltip";
import { type PushClientState } from "@/Features/PushNotifications/DomainModel/PushClientContracts";

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

const PUSH_STATUS_READY: PushStatusKind = "ready";
const PUSH_STATUS_ENABLING: PushStatusKind = "enabling";
const PUSH_STATUS_ENABLED: PushStatusKind = "enabled";
const PUSH_STATUS_BLOCKED: PushStatusKind = "blocked";

const PUSH_STATUS_LABELS: Record<PushStatusKind, string> = {
  [PUSH_STATUS_READY]: "Enable",
  [PUSH_STATUS_ENABLING]: "Enabling",
  [PUSH_STATUS_ENABLED]: "Enabled",
  [PUSH_STATUS_BLOCKED]: "Blocked",
};

const PUSH_STATUS_DESCRIPTIONS: Record<PushStatusKind, string> = {
  [PUSH_STATUS_READY]: "Enable notifications",
  [PUSH_STATUS_ENABLING]: "Enabling notifications",
  [PUSH_STATUS_ENABLED]: "Notifications enabled",
  [PUSH_STATUS_BLOCKED]: "Notifications blocked by browser settings",
};

const PUSH_STATUS_CLASS_NAMES: Record<PushStatusKind, string> = {
  [PUSH_STATUS_READY]: "text-muted-foreground hover:text-foreground hover:bg-muted",
  [PUSH_STATUS_ENABLING]: "text-muted-foreground hover:text-foreground hover:bg-muted",
  [PUSH_STATUS_ENABLED]: "bg-muted text-foreground hover:bg-muted",
  [PUSH_STATUS_BLOCKED]:
    "text-amber-700 hover:text-amber-700 hover:bg-amber-100/60 dark:text-amber-300 dark:hover:bg-amber-500/15",
};

const BUTTON_BASE_CLASS_NAME = "h-8 rounded-lg px-2 gap-1.5";

function readPushStatusViewState(input: {
  pushClientState: PushClientState;
  isEnablingPushNotifications: boolean;
}): PushStatusViewState {
  const blockedByPermission =
    input.pushClientState.permission === "denied" ||
    input.pushClientState.permission === "unsupported";

  if (input.isEnablingPushNotifications) {
    return buildPushStatusViewState(PUSH_STATUS_ENABLING);
  }

  if (blockedByPermission) {
    return buildPushStatusViewState(PUSH_STATUS_BLOCKED);
  }

  if (input.pushClientState.subscribed) {
    return buildPushStatusViewState(PUSH_STATUS_ENABLED);
  }

  return buildPushStatusViewState(PUSH_STATUS_READY);
}

function buildPushStatusViewState(kind: PushStatusKind): PushStatusViewState {
  return {
    kind,
    label: PUSH_STATUS_LABELS[kind],
    description: PUSH_STATUS_DESCRIPTIONS[kind],
    canEnable: kind === PUSH_STATUS_READY,
  };
}

function readPushStatusIcon(kind: PushStatusKind): React.JSX.Element {
  if (kind === PUSH_STATUS_ENABLING) {
    return <Loader2 size={14} className="animate-spin" />;
  }
  if (kind === PUSH_STATUS_ENABLED) {
    return <BellRing size={14} />;
  }
  if (kind === PUSH_STATUS_BLOCKED) {
    return <BellOff size={14} />;
  }
  return <Bell size={14} />;
}

export function PushStatusButton({
  pushClientState,
  isEnablingPushNotifications,
  onEnablePushNotifications,
}: PushStatusButtonProps): React.JSX.Element | null {
  if (!pushClientState.supported) {
    return null;
  }

  const statusViewState = readPushStatusViewState({
    pushClientState,
    isEnablingPushNotifications,
  });
  const isDisabled = !statusViewState.canEnable;
  const iconNode = readPushStatusIcon(statusViewState.kind);

  const buttonNode = (
    <Button
      type="button"
      onClick={statusViewState.canEnable ? onEnablePushNotifications : undefined}
      disabled={isDisabled}
      data-testid="enable-notifications-button"
      data-push-status={statusViewState.kind}
      aria-label={statusViewState.description}
      title={statusViewState.description}
      variant="ghost"
      size="sm"
      className={`${BUTTON_BASE_CLASS_NAME} ${PUSH_STATUS_CLASS_NAMES[statusViewState.kind]}`}
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

import { Bell, Loader2 } from "lucide-react";
import { type PushClientState } from "@/Features/PushNotifications/DomainModel/PushClientContracts";
import { Button } from "@/Components/UserInterface/Button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/Components/UserInterface/Tooltip";

interface PushStatusButtonProps {
  pushClientState: PushClientState;
  isEnablingPushNotifications: boolean;
  onEnablePushNotifications: () => void;
}

export function PushStatusButton({
  pushClientState,
  isEnablingPushNotifications,
  onEnablePushNotifications
}: PushStatusButtonProps): React.JSX.Element | null {
  if (!pushClientState.supported) {
    return null;
  }

  const isDisabled = (
    isEnablingPushNotifications
    || pushClientState.subscribed
    || pushClientState.permission === "denied"
  );
  const isActive = pushClientState.subscribed;
  const title = pushClientState.subscribed
    ? "Notifications enabled"
    : pushClientState.permission === "denied"
      ? "Notifications blocked by browser settings"
      : "Enable notifications";

  const buttonNode = (
    <Button
      type="button"
      onClick={onEnablePushNotifications}
      disabled={isDisabled}
      data-testid="enable-notifications-button"
      variant="ghost"
      size="icon"
      className={`h-8 w-8 rounded-lg ${
        isActive
          ? "bg-muted text-foreground hover:bg-muted"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      {isEnablingPushNotifications ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <Bell size={14} />
      )}
    </Button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{buttonNode}</TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
}

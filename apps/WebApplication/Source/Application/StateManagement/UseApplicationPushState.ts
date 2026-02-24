import { type Dispatch, type SetStateAction, useState } from "react";
import { type PushClientState } from "@/Features/PushNotifications/DomainModel/PushClientContracts";

export interface UseApplicationPushStateInput {
  unsupportedPushClientState: PushClientState;
}

export interface ApplicationPushStateSlice {
  pushClientState: PushClientState;
  setPushClientState: Dispatch<SetStateAction<PushClientState>>;
  isEnablingPushNotifications: boolean;
  setIsEnablingPushNotifications: Dispatch<SetStateAction<boolean>>;
  requiresApiSessionToken: boolean;
  setRequiresApiSessionToken: Dispatch<SetStateAction<boolean>>;
  apiSessionTokenDraft: string;
  setApiSessionTokenDraft: Dispatch<SetStateAction<string>>;
  apiSessionBootstrapError: string;
  setApiSessionBootstrapError: Dispatch<SetStateAction<string>>;
  isApiSessionBootstrapPending: boolean;
  setIsApiSessionBootstrapPending: Dispatch<SetStateAction<boolean>>;
}

export function useApplicationPushState(input: UseApplicationPushStateInput): ApplicationPushStateSlice {
  const [pushClientState, setPushClientState] = useState<PushClientState>(
    input.unsupportedPushClientState
  );
  const [isEnablingPushNotifications, setIsEnablingPushNotifications] = useState(false);
  const [requiresApiSessionToken, setRequiresApiSessionToken] = useState(false);
  const [apiSessionTokenDraft, setApiSessionTokenDraft] = useState("");
  const [apiSessionBootstrapError, setApiSessionBootstrapError] = useState("");
  const [isApiSessionBootstrapPending, setIsApiSessionBootstrapPending] = useState(false);

  return {
    pushClientState,
    setPushClientState,
    isEnablingPushNotifications,
    setIsEnablingPushNotifications,
    requiresApiSessionToken,
    setRequiresApiSessionToken,
    apiSessionTokenDraft,
    setApiSessionTokenDraft,
    apiSessionBootstrapError,
    setApiSessionBootstrapError,
    isApiSessionBootstrapPending,
    setIsApiSessionBootstrapPending
  };
}

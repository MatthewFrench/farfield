import { type Dispatch, type SetStateAction, useState } from "react";
import { type PushClientState } from "@/Features/PushNotifications/DomainModel/PushClientContracts";

const INITIAL_PUSH_STATE_FLAGS = {
  isEnablingPushNotifications: false,
  requiresApiSessionToken: false,
  isApiSessionBootstrapPending: false
};

const INITIAL_API_SESSION_TOKEN_DRAFT = "";
const INITIAL_API_SESSION_BOOTSTRAP_ERROR_MESSAGE = "";

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
  const { unsupportedPushClientState } = input;
  const [pushClientState, setPushClientState] = useState<PushClientState>(
    unsupportedPushClientState
  );
  const [isEnablingPushNotifications, setIsEnablingPushNotifications] = useState(
    INITIAL_PUSH_STATE_FLAGS.isEnablingPushNotifications
  );
  const [requiresApiSessionToken, setRequiresApiSessionToken] = useState(
    INITIAL_PUSH_STATE_FLAGS.requiresApiSessionToken
  );
  const [apiSessionTokenDraft, setApiSessionTokenDraft] = useState(
    INITIAL_API_SESSION_TOKEN_DRAFT
  );
  const [apiSessionBootstrapError, setApiSessionBootstrapError] = useState(
    INITIAL_API_SESSION_BOOTSTRAP_ERROR_MESSAGE
  );
  const [isApiSessionBootstrapPending, setIsApiSessionBootstrapPending] = useState(
    INITIAL_PUSH_STATE_FLAGS.isApiSessionBootstrapPending
  );

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

import {
  type AppServerClient,
  type CodexMonitorService,
  type DesktopIpcClient,
} from "@farfield/api";
import { type CodexIpcFrameEvent } from "./CodexAgentAdapterContracts.js";
import type { CodexConnectionLifecycleOwner } from "./CodexConnectionLifecycleOwner.js";
import { CodexMessageDispatchOwner } from "./CodexMessageDispatchOwner.js";
import { CodexThreadInteractionOwner } from "./CodexThreadInteractionOwner.js";
import { CodexThreadManagementOwner } from "./CodexThreadManagementOwner.js";
import type { CodexThreadStreamStateOwner } from "./CodexThreadStreamStateOwner.js";

interface CodexAgentAdapterOwnerFactoryInput {
  appClient: AppServerClient;
  ipcClient: DesktopIpcClient;
  service: CodexMonitorService;
  threadStreamStateOwner: CodexThreadStreamStateOwner;
  connectionLifecycleOwner: CodexConnectionLifecycleOwner;
  emitIpcFrame: (event: CodexIpcFrameEvent) => void;
  ensureCodexAvailable: () => void;
  ensureIpcReady: () => void;
  isConversationNotFoundError: <ErrorType>(error: ErrorType) => boolean;
}

interface CodexAgentAdapterOwners {
  messageDispatchOwner: CodexMessageDispatchOwner;
  threadManagementOwner: CodexThreadManagementOwner;
  threadInteractionOwner: CodexThreadInteractionOwner;
}

/**
 * Owns owner/dependency wiring for Codex adapter domain actions so adapter runtime
 * composition remains a thin bootstrap layer.
 */
export function createCodexAgentAdapterOwners(
  input: CodexAgentAdapterOwnerFactoryInput,
): CodexAgentAdapterOwners {
  const runAppServerCall = async <ValueType>(
    operation: () => Promise<ValueType>,
  ): Promise<ValueType> => {
    return input.connectionLifecycleOwner.runAppServerCall(operation);
  };

  const messageDispatchOwner = new CodexMessageDispatchOwner({
    appClient: input.appClient,
    service: input.service,
    threadStreamStateOwner: input.threadStreamStateOwner,
    runAppServerCall,
    isConversationNotFoundError: input.isConversationNotFoundError,
  });
  const threadManagementOwner = new CodexThreadManagementOwner({
    appClient: input.appClient,
    runAppServerCall,
    ensureCodexAvailable: input.ensureCodexAvailable,
  });
  const threadInteractionOwner = new CodexThreadInteractionOwner({
    appClient: input.appClient,
    service: input.service,
    ipcClient: input.ipcClient,
    threadStreamStateOwner: input.threadStreamStateOwner,
    runAppServerCall,
    ensureCodexAvailable: input.ensureCodexAvailable,
    ensureIpcReady: input.ensureIpcReady,
    isIpcReady: () => {
      return input.connectionLifecycleOwner.isIpcReady();
    },
    emitIpcFrame: input.emitIpcFrame,
  });

  return {
    messageDispatchOwner,
    threadManagementOwner,
    threadInteractionOwner,
  };
}

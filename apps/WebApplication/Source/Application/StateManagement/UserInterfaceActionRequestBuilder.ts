import type { ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";

const ACTION_IDENTIFIER_PREFIX = "action";
const ACTION_IDENTIFIER_RANDOM_UPPER_BOUND = 1_000_000_000;
const EMPTY_ACTION_NAME_ERROR_MESSAGE = "Action name is required";

function createUserInterfaceActionId(): string {
  return (
    `${ACTION_IDENTIFIER_PREFIX}_${String(Date.now())}_` +
    `${Math.floor(Math.random() * ACTION_IDENTIFIER_RANDOM_UPPER_BOUND).toString(16)}`
  );
}

function normalizeActionName(actionName: string): string {
  const normalizedActionName = actionName.trim();
  if (normalizedActionName.length === 0) {
    throw new Error(EMPTY_ACTION_NAME_ERROR_MESSAGE);
  }
  return normalizedActionName;
}

export interface UserInterfaceActionRequest {
  actionId: string;
  requestOptions: ApiRequestOptions;
}

export class UserInterfaceActionRequestBuilder {
  private readonly readActionId: () => string;

  public constructor(readActionId?: () => string) {
    this.readActionId = readActionId ?? createUserInterfaceActionId;
  }

  public create(actionName: string): UserInterfaceActionRequest {
    const normalizedActionName = normalizeActionName(actionName);
    const actionId = this.readActionId();
    return {
      actionId,
      requestOptions: {
        actionId,
        actionName: normalizedActionName,
      },
    };
  }
}

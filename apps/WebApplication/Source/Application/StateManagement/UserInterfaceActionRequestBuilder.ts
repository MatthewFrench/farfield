import type { ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";

function createUserInterfaceActionId(): string {
  return `action_${String(Date.now())}_${Math.floor(Math.random() * 1_000_000_000).toString(16)}`;
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
    const actionId = this.readActionId();
    return {
      actionId,
      requestOptions: {
        actionId,
        actionName
      }
    };
  }
}

import type { ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import { createUiActionId } from "@/SharedUtilities/DebugHelpers";

export interface UserInterfaceActionRequest {
  actionId: string;
  requestOptions: ApiRequestOptions;
}

export class UserInterfaceActionRequestBuilder {
  private readonly readActionId: () => string;

  public constructor(readActionId?: () => string) {
    this.readActionId = readActionId ?? createUiActionId;
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

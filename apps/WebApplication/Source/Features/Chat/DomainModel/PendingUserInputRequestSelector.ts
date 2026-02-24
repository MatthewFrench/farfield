import { ThreadConversationStateSchema, UserInputRequestSchema } from "@farfield/protocol";
import { z } from "zod";

export type PendingUserInputRequest = z.infer<typeof UserInputRequestSchema>;

export class PendingUserInputRequestSelector {
  public readPendingUserInputRequests(
    conversationState: z.infer<typeof ThreadConversationStateSchema> | null
  ): PendingUserInputRequest[] {
    if (!conversationState) {
      return [];
    }

    return conversationState.requests.filter((request) => {
      if (request.method !== "item/tool/requestUserInput") {
        return false;
      }
      return request.completed !== true;
    });
  }
}

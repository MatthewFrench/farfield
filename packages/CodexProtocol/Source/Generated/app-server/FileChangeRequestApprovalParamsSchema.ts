// GENERATED FILE. DO NOT EDIT.
// Source: vendor/codex-app-server-schema/stable/json/FileChangeRequestApprovalParams.json
import { z } from "zod";

export const FileChangeRequestApprovalParamsSchema = z.object({
  grantRoot: z
    .union([
      z
        .string()
        .describe(
          "[UNSTABLE] When set, the agent is asking the user to allow writes under this root for the remainder of the session (unclear if this is honored today).",
        ),
      z
        .null()
        .describe(
          "[UNSTABLE] When set, the agent is asking the user to allow writes under this root for the remainder of the session (unclear if this is honored today).",
        ),
    ])
    .describe(
      "[UNSTABLE] When set, the agent is asking the user to allow writes under this root for the remainder of the session (unclear if this is honored today).",
    )
    .optional(),
  itemId: z.string(),
  reason: z
    .union([
      z.string().describe("Optional explanatory reason (e.g. request for extra write access)."),
      z.null().describe("Optional explanatory reason (e.g. request for extra write access)."),
    ])
    .describe("Optional explanatory reason (e.g. request for extra write access).")
    .optional(),
  threadId: z.string(),
  turnId: z.string(),
});

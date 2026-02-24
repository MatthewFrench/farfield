import { z } from "zod";

export const DebugWorkspaceSectionSchema = z.enum(["issues", "history", "stream", "trace"]);

export type DebugWorkspaceSection = z.infer<typeof DebugWorkspaceSectionSchema>;

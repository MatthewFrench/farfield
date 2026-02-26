import { z } from "zod";

export const DebugWorkspaceSectionSchema = z.enum(["issues", "history", "stream", "trace"]);

export type DebugWorkspaceSection = z.infer<typeof DebugWorkspaceSectionSchema>;

export function parseDebugWorkspaceSection(value: string): DebugWorkspaceSection {
  return DebugWorkspaceSectionSchema.parse(value);
}

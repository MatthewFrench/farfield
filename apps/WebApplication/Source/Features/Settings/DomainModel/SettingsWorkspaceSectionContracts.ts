import { z } from "zod";

const SettingsWorkspaceSectionSchema = z.enum(["notifications", "debug"]);

export type SettingsWorkspaceSection = z.infer<typeof SettingsWorkspaceSectionSchema>;

export function parseSettingsWorkspaceSection(value: string): SettingsWorkspaceSection {
  return SettingsWorkspaceSectionSchema.parse(value);
}

import { z } from "zod";
import type { GitDiffToRemoteOptions } from "./AppServerClient.js";

const AppServerGitDiffToRemoteRequestSchema = z
  .object({
    cwd: z.string().min(1),
  })
  .passthrough();

interface GitDiffToRemoteRequestParameters {
  cwd: string;
}

export function buildGitDiffToRemoteRequestParameters(
  options: GitDiffToRemoteOptions,
): GitDiffToRemoteRequestParameters {
  return AppServerGitDiffToRemoteRequestSchema.parse({
    cwd: options.cwd,
  });
}

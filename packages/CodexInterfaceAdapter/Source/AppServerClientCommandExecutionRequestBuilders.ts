import { z } from "zod";
import type { CommandExecutionOptions } from "./AppServerClient.js";

const AppServerCommandExecRequestSchema = z
  .object({
    command: z.array(z.string().min(1)).min(1),
    timeoutMs: z.number().int().nonnegative().nullable().optional(),
    cwd: z.union([z.string().min(1), z.null()]).optional(),
  })
  .passthrough();

interface CommandExecRequestParameters {
  command: string[];
  timeoutMs?: number | null | undefined;
  cwd?: string | null | undefined;
}

export function buildCommandExecutionRequestParameters(
  options: CommandExecutionOptions,
): CommandExecRequestParameters {
  return AppServerCommandExecRequestSchema.parse({
    command: options.command,
    ...(options.timeoutMilliseconds !== undefined
      ? { timeoutMs: options.timeoutMilliseconds }
      : {}),
    ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
  });
}

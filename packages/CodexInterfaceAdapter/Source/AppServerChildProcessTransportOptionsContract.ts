import { z } from "zod";
import { ProcessEnvironmentSchema } from "./AppServerSpawnEnvironmentContract.js";

export interface ChildProcessAppServerTransportOptions {
  executablePath: string;
  userAgent: string;
  baseEnvironment: NodeJS.ProcessEnv;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  requestTimeoutMs?: number;
  notificationEventLimit?: number;
  onStderr?: (line: string) => void;
}

const ChildProcessAppServerTransportOptionsSchema = z
  .object({
    executablePath: z.string().min(1),
    userAgent: z.string().min(1),
    baseEnvironment: ProcessEnvironmentSchema,
    cwd: z.string().min(1).optional(),
    env: ProcessEnvironmentSchema.optional(),
    requestTimeoutMs: z.number().int().positive().optional(),
    notificationEventLimit: z.number().int().positive().optional(),
    onStderr: z.function().args(z.string()).returns(z.void()).optional(),
  })
  .strict();

/**
 * Owns parsing and classification for child-process transport options.
 * Non-owner modules consume the parsed contract instead of probing option shapes directly.
 */
export function parseChildProcessAppServerTransportOptions(
  options: ChildProcessAppServerTransportOptions,
): ChildProcessAppServerTransportOptions {
  const parsedOptions = ChildProcessAppServerTransportOptionsSchema.parse(options);

  const normalizedOptions: ChildProcessAppServerTransportOptions = {
    executablePath: parsedOptions.executablePath,
    userAgent: parsedOptions.userAgent,
    baseEnvironment: parsedOptions.baseEnvironment,
    ...(parsedOptions.cwd !== undefined ? { cwd: parsedOptions.cwd } : {}),
    ...(parsedOptions.env !== undefined ? { env: parsedOptions.env } : {}),
    ...(parsedOptions.requestTimeoutMs !== undefined
      ? { requestTimeoutMs: parsedOptions.requestTimeoutMs }
      : {}),
    ...(parsedOptions.notificationEventLimit !== undefined
      ? { notificationEventLimit: parsedOptions.notificationEventLimit }
      : {}),
    ...(parsedOptions.onStderr !== undefined ? { onStderr: parsedOptions.onStderr } : {}),
  };

  return normalizedOptions;
}

export function isChildProcessAppServerTransportOptionsValue(
  value: object,
): value is ChildProcessAppServerTransportOptions {
  return ChildProcessAppServerTransportOptionsSchema.safeParse(value).success;
}

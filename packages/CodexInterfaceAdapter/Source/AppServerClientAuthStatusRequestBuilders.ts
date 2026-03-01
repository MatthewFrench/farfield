import { z } from "zod";
import type { ReadAuthStatusOptions } from "./AppServerClient.js";

const AppServerAuthStatusRequestSchema = z
  .object({
    includeToken: z.boolean().nullable(),
    refreshToken: z.boolean().nullable(),
  })
  .passthrough();

interface AuthStatusRequestParameters {
  includeToken: boolean | null;
  refreshToken: boolean | null;
}

export function buildReadAuthStatusRequestParameters(
  options?: ReadAuthStatusOptions,
): AuthStatusRequestParameters {
  return AppServerAuthStatusRequestSchema.parse({
    includeToken: options?.includeToken ?? null,
    refreshToken: options?.refreshToken ?? null,
  });
}

import { z } from "zod";
import type { WindowsSandboxSetupStartOptions } from "./AppServerClient.js";

const AppServerWindowsSandboxSetupModeSchema = z.enum(["elevated", "unelevated"]);
const AppServerWindowsSandboxSetupStartRequestSchema = z
  .object({
    mode: AppServerWindowsSandboxSetupModeSchema,
  })
  .passthrough();

interface WindowsSandboxSetupStartRequestParameters {
  mode: "elevated" | "unelevated";
}

export function buildWindowsSandboxSetupStartRequestParameters(
  options: WindowsSandboxSetupStartOptions,
): WindowsSandboxSetupStartRequestParameters {
  return AppServerWindowsSandboxSetupStartRequestSchema.parse({
    mode: options.mode,
  });
}

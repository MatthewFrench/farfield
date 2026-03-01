import { z } from "zod";
import { type AgentId, type ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import { request, requestInitWithOptions } from "@/Shared/Transport/FarfieldHttpTransport";

const WINDOWS_SANDBOX_SETUP_START_ENDPOINT = "/api/windows-sandbox/setup-start";

const WindowsSandboxSetupModeSchema = z.enum(["elevated", "unelevated"]);
export type ApiWindowsSandboxSetupMode = z.infer<typeof WindowsSandboxSetupModeSchema>;

export interface ApiWindowsSandboxSetupStartOptions extends ApiRequestOptions {
  agentId?: AgentId;
  mode: ApiWindowsSandboxSetupMode;
}

const WindowsSandboxSetupStartInputSchema = z
  .object({
    mode: WindowsSandboxSetupModeSchema,
  })
  .strict();

const WindowsSandboxSetupStartResponseSchema = z
  .object({
    ok: z.literal(true),
    started: z.boolean(),
  })
  .strict();
export type ApiWindowsSandboxSetupStartResponse = z.infer<
  typeof WindowsSandboxSetupStartResponseSchema
>;

function readWindowsSandboxSetupStartPath(options: ApiWindowsSandboxSetupStartOptions): string {
  const parsedInput = WindowsSandboxSetupStartInputSchema.parse({
    mode: options.mode,
  });
  const params = new URLSearchParams();
  if (options.agentId !== undefined) {
    params.set("agentId", options.agentId);
  }
  params.set("mode", parsedInput.mode);
  return `${WINDOWS_SANDBOX_SETUP_START_ENDPOINT}?${params.toString()}`;
}

export async function startWindowsSandboxSetup(
  options: ApiWindowsSandboxSetupStartOptions,
): Promise<ApiWindowsSandboxSetupStartResponse> {
  return WindowsSandboxSetupStartResponseSchema.parse(
    await request(readWindowsSandboxSetupStartPath(options), {
      ...requestInitWithOptions(options),
      method: "POST",
    }),
  );
}

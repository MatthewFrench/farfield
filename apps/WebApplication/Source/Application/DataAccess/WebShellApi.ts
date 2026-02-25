import { FarfieldEventsSessionResponseSchema } from "@farfield/protocol";
import { z } from "zod";
import { type ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import {
  applyRequestOptions,
  request
} from "@/Shared/Transport/FarfieldHttpTransport";

const WebShellHealthResponseSchema = z
  .object({
    ok: z.literal(true),
    service: z.literal("farfield-web-shell"),
    buildId: z.string().min(1),
    gitCommit: z.string().nullable(),
    serviceWorkerVersion: z.string().nullable(),
    timestamp: z.string().datetime()
  })
  .strict();
export type ApiWebShellHealthResponse = z.infer<typeof WebShellHealthResponseSchema>;

const EventsSessionBootstrapResponseSchema = FarfieldEventsSessionResponseSchema;
export type ApiEventsSessionBootstrapResponse = z.infer<typeof EventsSessionBootstrapResponseSchema>;
const EventsSessionBootstrapRequestSchema = z
  .object({
    apiToken: z.string().trim().min(1)
  })
  .strict();
export type ApiEventsSessionBootstrapRequest = z.infer<typeof EventsSessionBootstrapRequestSchema>;

export async function bootstrapEventsSession(
  input?: ApiEventsSessionBootstrapRequest,
  options?: ApiRequestOptions
): Promise<ApiEventsSessionBootstrapResponse> {
  const requestInit: RequestInit = {
    method: "POST"
  };
  if (input) {
    const payload = EventsSessionBootstrapRequestSchema.parse(input);
    requestInit.headers = {
      "Content-Type": "application/json"
    };
    requestInit.body = JSON.stringify(payload);
  }
  return EventsSessionBootstrapResponseSchema.parse(await request(
    "/api/events/session",
    applyRequestOptions(requestInit, options)
  ));
}

export async function getWebShellHealth(): Promise<ApiWebShellHealthResponse> {
  return WebShellHealthResponseSchema.parse(await request("/healthz"));
}

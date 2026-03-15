import { FarfieldEventsSessionResponseSchema } from "@farfield/protocol";
import { z } from "zod";
import { type ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import { applyRequestOptions, request } from "@/Shared/Transport/FarfieldHttpTransport";

const EVENTS_SESSION_ENDPOINT = "/api/events/session";
const WEB_SHELL_HEALTH_ENDPOINT = "/healthz";
const POST_METHOD = "POST";
const JSON_CONTENT_TYPE_HEADER_VALUE = "application/json";

const WebShellHealthResponseSchema = z
  .object({
    ok: z.literal(true),
    service: z.literal("farfield-web-shell"),
    buildId: z.string().min(1),
    gitCommit: z.string().nullable(),
    serviceWorkerVersion: z.string().nullable(),
    timestamp: z.string().datetime(),
  })
  .strict();
export type ApiWebShellHealthResponse = z.infer<typeof WebShellHealthResponseSchema>;

const EventsSessionBootstrapResponseSchema = FarfieldEventsSessionResponseSchema;
export type ApiEventsSessionBootstrapResponse = z.infer<
  typeof EventsSessionBootstrapResponseSchema
>;
const EventsSessionBootstrapRequestSchema = z
  .object({
    apiToken: z.string().trim().min(1),
  })
  .strict();
export type ApiEventsSessionBootstrapRequest = z.infer<typeof EventsSessionBootstrapRequestSchema>;

function buildEventsSessionBootstrapRequestInit(
  input?: ApiEventsSessionBootstrapRequest,
): RequestInit {
  if (!input) {
    return {
      method: POST_METHOD,
    };
  }

  const payload = EventsSessionBootstrapRequestSchema.parse(input);
  return {
    method: POST_METHOD,
    headers: {
      "Content-Type": JSON_CONTENT_TYPE_HEADER_VALUE,
    },
    body: JSON.stringify(payload),
  };
}

export async function bootstrapEventsSession(
  input?: ApiEventsSessionBootstrapRequest,
  options?: ApiRequestOptions,
): Promise<ApiEventsSessionBootstrapResponse> {
  return EventsSessionBootstrapResponseSchema.parse(
    await request(
      EVENTS_SESSION_ENDPOINT,
      applyRequestOptions(buildEventsSessionBootstrapRequestInit(input), options),
    ),
  );
}

export async function getWebShellHealth(): Promise<ApiWebShellHealthResponse> {
  return WebShellHealthResponseSchema.parse(await request(WEB_SHELL_HEALTH_ENDPOINT));
}

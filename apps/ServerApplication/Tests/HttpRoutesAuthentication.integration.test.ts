import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ApiErrorEnvelopeSchema,
  EventsSessionEnvelopeSchema,
  HealthEnvelopeSchema,
  HttpRoutesIntegrationEnvironment,
} from "./HttpRoutesIntegrationEnvironment";

const HealthRoutePath = "/api/health";
const EventsSessionRoutePath = "/api/events/session";
const JsonContentTypeHeaderName = "Content-Type";
const JsonContentTypeHeaderValue = "application/json";
const CookieHeaderName = "Cookie";

describe("server route integration authentication", () => {
  const integrationEnvironment = new HttpRoutesIntegrationEnvironment();

  beforeAll(async () => {
    await integrationEnvironment.start();
  }, 30_000);

  afterAll(async () => {
    await integrationEnvironment.stop();
  });

  it("enforces API auth and exposes health shape", async () => {
    const unauthorizedResponse = await fetch(
      integrationEnvironment.buildApiRouteUrl(HealthRoutePath),
    );
    expect(unauthorizedResponse.status).toBe(401);
    ApiErrorEnvelopeSchema.parse(await unauthorizedResponse.json());

    const authorizedResponse = await fetch(
      integrationEnvironment.buildApiRouteUrl(HealthRoutePath),
      {
        headers: integrationEnvironment.readAuthHeaders(),
      },
    );
    expect(authorizedResponse.status).toBe(200);
    const health = HealthEnvelopeSchema.parse(await authorizedResponse.json());
    expect(health.state.pushSubscriptionCount).toBe(0);
  });

  it("supports events session bootstrap", async () => {
    const apiToken = integrationEnvironment.readApiToken();

    const firstResponse = await fetch(
      integrationEnvironment.buildApiRouteUrl(EventsSessionRoutePath),
      {
        method: "POST",
      },
    );

    expect(firstResponse.status).toBe(200);
    const firstPayload = EventsSessionEnvelopeSchema.parse(await firstResponse.json());
    expect(firstPayload.authRequired).toBe(true);
    expect(firstPayload.bootstrapped).toBe(false);
    expect(firstPayload.expiresAt).toBeNull();

    const bootstrapResponse = await fetch(
      integrationEnvironment.buildApiRouteUrl(EventsSessionRoutePath),
      {
        method: "POST",
        headers: {
          [JsonContentTypeHeaderName]: JsonContentTypeHeaderValue,
        },
        body: JSON.stringify({
          apiToken,
        }),
      },
    );

    expect(bootstrapResponse.status).toBe(200);
    const bootstrapPayload = EventsSessionEnvelopeSchema.parse(await bootstrapResponse.json());
    expect(bootstrapPayload.authRequired).toBe(true);
    expect(bootstrapPayload.bootstrapped).toBe(true);
    expect(bootstrapPayload.expiresAt).not.toBeNull();
    const sessionCookie = integrationEnvironment.readSessionCookieFromResponse(bootstrapResponse);

    const healthViaCookieResponse = await fetch(
      integrationEnvironment.buildApiRouteUrl(HealthRoutePath),
      {
        headers: {
          [CookieHeaderName]: sessionCookie,
        },
      },
    );
    expect(healthViaCookieResponse.status).toBe(200);
    HealthEnvelopeSchema.parse(await healthViaCookieResponse.json());
  });
});

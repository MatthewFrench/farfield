import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it
} from "vitest";
import {
  ApiErrorEnvelopeSchema,
  EventsSessionEnvelopeSchema,
  HealthEnvelopeSchema,
  HttpRoutesIntegrationEnvironment
} from "./HttpRoutesIntegrationEnvironment";

describe("server route integration authentication", () => {
  const integrationEnvironment = new HttpRoutesIntegrationEnvironment();

  beforeAll(async () => {
    await integrationEnvironment.start();
  }, 30_000);

  afterAll(async () => {
    await integrationEnvironment.stop();
  });

  it("enforces API auth and exposes health shape", async () => {
    const baseUrl = integrationEnvironment.readBaseUrl();
    const apiToken = integrationEnvironment.readApiToken();

    const unauthorizedResponse = await fetch(`${baseUrl}/api/health`);
    expect(unauthorizedResponse.status).toBe(401);
    ApiErrorEnvelopeSchema.parse(await unauthorizedResponse.json());

    const authorizedResponse = await fetch(`${baseUrl}/api/health`, {
      headers: {
        "X-Farfield-Token": apiToken
      }
    });
    expect(authorizedResponse.status).toBe(200);
    const health = HealthEnvelopeSchema.parse(await authorizedResponse.json());
    expect(health.state.pushSubscriptionCount).toBe(0);
  });

  it("supports events session bootstrap", async () => {
    const baseUrl = integrationEnvironment.readBaseUrl();
    const apiToken = integrationEnvironment.readApiToken();

    const firstResponse = await fetch(`${baseUrl}/api/events/session`, {
      method: "POST"
    });

    expect(firstResponse.status).toBe(200);
    const firstPayload = EventsSessionEnvelopeSchema.parse(await firstResponse.json());
    expect(firstPayload.authRequired).toBe(true);
    expect(firstPayload.bootstrapped).toBe(false);
    expect(firstPayload.expiresAt).toBeNull();

    const bootstrapResponse = await fetch(`${baseUrl}/api/events/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        apiToken
      })
    });

    expect(bootstrapResponse.status).toBe(200);
    const bootstrapPayload = EventsSessionEnvelopeSchema.parse(await bootstrapResponse.json());
    expect(bootstrapPayload.authRequired).toBe(true);
    expect(bootstrapPayload.bootstrapped).toBe(true);
    expect(bootstrapPayload.expiresAt).not.toBeNull();
    const sessionCookie = bootstrapResponse.headers.get("set-cookie");
    expect(sessionCookie).toContain("farfield_session=");

    const healthViaCookieResponse = await fetch(`${baseUrl}/api/health`, {
      headers: {
        ...(sessionCookie ? { Cookie: sessionCookie } : {})
      }
    });
    expect(healthViaCookieResponse.status).toBe(200);
    HealthEnvelopeSchema.parse(await healthViaCookieResponse.json());
  });
});

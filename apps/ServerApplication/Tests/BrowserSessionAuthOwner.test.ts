import { describe, expect, it } from "vitest";
import {
  BrowserSessionAuthOwner,
  type BrowserSessionAuthOwnerConfiguration,
} from "../Source/Network/BrowserSessionAuthOwner.js";

const DefaultIssuedAtMilliseconds = 1_700_000_000_000;
const DefaultCookieName = "farfield_session";
const DefaultSessionTimeToLiveMilliseconds = 60_000;
const DefaultSigningSecret = "secret_value";
const CookieSegmentDelimiter = ";";
const CookieNameValueDelimiter = "=";
const SessionTokenPartCount = 4;

interface BrowserSessionAuthOwnerConfigurationOverrides {
  cookieName?: string;
  sessionTimeToLiveMs?: number;
  signingSecret?: string;
  secureCookie?: boolean;
}

function createBrowserSessionAuthOwnerConfiguration(
  overrides: BrowserSessionAuthOwnerConfigurationOverrides = {},
): BrowserSessionAuthOwnerConfiguration {
  return {
    cookieName: overrides.cookieName ?? DefaultCookieName,
    sessionTimeToLiveMs: overrides.sessionTimeToLiveMs ?? DefaultSessionTimeToLiveMilliseconds,
    signingSecret: overrides.signingSecret ?? DefaultSigningSecret,
    secureCookie: overrides.secureCookie ?? false,
  };
}

function createBrowserSessionAuthOwner(
  configurationOverrides: BrowserSessionAuthOwnerConfigurationOverrides = {},
  now: () => number = () => DefaultIssuedAtMilliseconds,
  randomBytesValue: string = "session_nonce_value_default",
): BrowserSessionAuthOwner {
  return new BrowserSessionAuthOwner(
    createBrowserSessionAuthOwnerConfiguration(configurationOverrides),
    {
      now,
      randomBytesFactory: () => Buffer.from(randomBytesValue),
    },
  );
}

function readCookieNameValuePairFromSetCookieHeader(setCookieHeaderValue: string): string {
  const firstCookieSegmentDelimiterIndex = setCookieHeaderValue.indexOf(CookieSegmentDelimiter);
  if (firstCookieSegmentDelimiterIndex < 0) {
    return setCookieHeaderValue.trim();
  }
  return setCookieHeaderValue.slice(0, firstCookieSegmentDelimiterIndex).trim();
}

function readCookieValueFromSetCookieHeader(setCookieHeaderValue: string): string {
  const cookieNameValuePair = readCookieNameValuePairFromSetCookieHeader(setCookieHeaderValue);
  const cookieNameValueDelimiterIndex = cookieNameValuePair.indexOf(CookieNameValueDelimiter);
  if (
    cookieNameValueDelimiterIndex <= 0 ||
    cookieNameValueDelimiterIndex >= cookieNameValuePair.length - 1
  ) {
    throw new Error("Expected cookie name and value pair");
  }
  return cookieNameValuePair.slice(cookieNameValueDelimiterIndex + 1).trim();
}

describe("BrowserSessionAuthOwner", () => {
  it("issues and validates a signed session cookie", () => {
    let nowMilliseconds = DefaultIssuedAtMilliseconds;
    const owner = createBrowserSessionAuthOwner({}, () => nowMilliseconds, "session_nonce_value_1");

    const issued = owner.issueSessionCookie();
    expect(issued.expiresAt).toBe(
      new Date(nowMilliseconds + DefaultSessionTimeToLiveMilliseconds).toISOString(),
    );
    expect(issued.setCookieHeaderValue).toContain("farfield_session=");
    expect(issued.setCookieHeaderValue).toContain("HttpOnly");
    expect(issued.setCookieHeaderValue).toContain("SameSite=Lax");

    const authenticated = owner.readSession(issued.setCookieHeaderValue);
    expect(authenticated.authenticated).toBe(true);
    expect(authenticated.expiresAt).toBe(issued.expiresAt);

    nowMilliseconds += 70_000;
    const expired = owner.readSession(issued.setCookieHeaderValue);
    expect(expired.authenticated).toBe(false);
    expect(expired.expiresAt).toBeNull();
  });

  it("rejects tampered token payloads", () => {
    const owner = createBrowserSessionAuthOwner(
      {},
      () => DefaultIssuedAtMilliseconds,
      "session_nonce_value_2",
    );

    const issued = owner.issueSessionCookie();
    const tokenValue = readCookieValueFromSetCookieHeader(issued.setCookieHeaderValue);
    const parts = tokenValue.split(".");
    if (parts.length !== SessionTokenPartCount) {
      throw new Error("Expected four-part session token");
    }

    const tamperedPayload = `${parts[0]}.${parts[1]}.tampered_nonce.${parts[3]}`;
    const tamperedCookie = `farfield_session=${tamperedPayload}`;
    const session = owner.readSession(tamperedCookie);
    expect(session.authenticated).toBe(false);
    expect(session.expiresAt).toBeNull();
  });

  it("uses at least one second for cookie max-age when session time to live is sub-second", () => {
    const owner = createBrowserSessionAuthOwner(
      {
        sessionTimeToLiveMs: 500,
      },
      () => DefaultIssuedAtMilliseconds,
      "session_nonce_value_3",
    );

    const issued = owner.issueSessionCookie();
    expect(issued.setCookieHeaderValue).toContain("Max-Age=1");
  });

  it("includes the secure directive when secure cookies are enabled", () => {
    const owner = createBrowserSessionAuthOwner(
      {
        secureCookie: true,
      },
      () => DefaultIssuedAtMilliseconds,
      "session_nonce_value_secure",
    );

    const issued = owner.issueSessionCookie();
    expect(issued.setCookieHeaderValue).toContain("Secure");
  });

  it("reads the configured session cookie from a multi-cookie header", () => {
    const owner = createBrowserSessionAuthOwner(
      {},
      () => DefaultIssuedAtMilliseconds,
      "session_nonce_value_multi",
    );
    const issued = owner.issueSessionCookie();
    const sessionCookieNameValuePair = readCookieNameValuePairFromSetCookieHeader(
      issued.setCookieHeaderValue,
    );
    const cookieHeaderValue = `tracking_cookie=enabled; ${sessionCookieNameValuePair}; theme=light`;

    const session = owner.readSession(cookieHeaderValue);

    expect(session.authenticated).toBe(true);
    expect(session.expiresAt).toBe(issued.expiresAt);
  });

  it("rejects malformed token segments with non-base64url content", () => {
    const owner = createBrowserSessionAuthOwner(
      {},
      () => DefaultIssuedAtMilliseconds,
      "session_nonce_value_4",
    );

    const malformedSession = owner.readSession(
      "farfield_session=1700000000000.1700000060000.bad+segment.signature",
    );
    expect(malformedSession.authenticated).toBe(false);
    expect(malformedSession.expiresAt).toBeNull();
  });

  it("rejects token segments where expiry timestamp is not after issue timestamp", () => {
    const owner = createBrowserSessionAuthOwner(
      {},
      () => DefaultIssuedAtMilliseconds,
      "session_nonce_value_5",
    );

    const malformedSession = owner.readSession(
      "farfield_session=1700000000000.1700000000000.noncevalue.signaturevalue",
    );
    expect(malformedSession.authenticated).toBe(false);
    expect(malformedSession.expiresAt).toBeNull();
  });

  it("validates constructor configuration with explicit errors", () => {
    expect(() => createBrowserSessionAuthOwner({ cookieName: "   " })).toThrow(
      "BrowserSessionAuthOwner requires a non-empty cookieName",
    );
    expect(() => createBrowserSessionAuthOwner({ sessionTimeToLiveMs: 0 })).toThrow(
      "BrowserSessionAuthOwner requires a positive integer sessionTimeToLiveMs",
    );
    expect(() => createBrowserSessionAuthOwner({ signingSecret: "   " })).toThrow(
      "BrowserSessionAuthOwner requires a non-empty signingSecret",
    );
  });
});

import { describe, expect, it } from "vitest";
import { BrowserSessionAuthOwner } from "../Source/Network/BrowserSessionAuthOwner.js";

describe("BrowserSessionAuthOwner", () => {
  it("issues and validates a signed session cookie", () => {
    let nowMs = 1_700_000_000_000;
    const owner = new BrowserSessionAuthOwner(
      {
        cookieName: "farfield_session",
        sessionTimeToLiveMs: 60_000,
        signingSecret: "secret_value",
        secureCookie: false
      },
      {
        now: () => nowMs,
        randomBytesFactory: () => Buffer.from("session_nonce_value_1")
      }
    );

    const issued = owner.issueSessionCookie();
    expect(issued.expiresAt).toBe(new Date(nowMs + 60_000).toISOString());
    expect(issued.setCookieHeaderValue).toContain("farfield_session=");
    expect(issued.setCookieHeaderValue).toContain("HttpOnly");
    expect(issued.setCookieHeaderValue).toContain("SameSite=Lax");

    const authenticated = owner.readSession(issued.setCookieHeaderValue);
    expect(authenticated.authenticated).toBe(true);
    expect(authenticated.expiresAt).toBe(issued.expiresAt);

    nowMs += 70_000;
    const expired = owner.readSession(issued.setCookieHeaderValue);
    expect(expired.authenticated).toBe(false);
    expect(expired.expiresAt).toBeNull();
  });

  it("rejects tampered token payloads", () => {
    const owner = new BrowserSessionAuthOwner(
      {
        cookieName: "farfield_session",
        sessionTimeToLiveMs: 60_000,
        signingSecret: "secret_value",
        secureCookie: false
      },
      {
        now: () => 1_700_000_000_000,
        randomBytesFactory: () => Buffer.from("session_nonce_value_2")
      }
    );

    const issued = owner.issueSessionCookie();
    const tokenValue = issued.setCookieHeaderValue
      .split(";")[0]
      ?.split("=")[1];
    if (!tokenValue) {
      throw new Error("Expected issued cookie value");
    }
    const parts = tokenValue.split(".");
    if (parts.length !== 4) {
      throw new Error("Expected four-part session token");
    }

    const tamperedPayload = `${parts[0]}.${parts[1]}.tampered_nonce.${parts[3]}`;
    const tamperedCookie = `farfield_session=${tamperedPayload}`;
    const session = owner.readSession(tamperedCookie);
    expect(session.authenticated).toBe(false);
    expect(session.expiresAt).toBeNull();
  });
});

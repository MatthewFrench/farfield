import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export interface BrowserSessionAuthOwnerConfiguration {
  cookieName: string;
  sessionTimeToLiveMs: number;
  signingSecret: string;
  secureCookie: boolean;
}

interface BrowserSessionAuthOwnerDependencies {
  now?: () => number;
  randomBytesFactory?: (size: number) => Buffer;
}

export interface BrowserSessionIssueResult {
  setCookieHeaderValue: string;
  expiresAt: string;
}

export interface BrowserSessionReadResult {
  authenticated: boolean;
  expiresAt: string | null;
}

interface ParsedSessionToken {
  issuedAtMs: number;
  expiresAtMs: number;
  nonce: string;
  signature: string;
}

export class BrowserSessionAuthOwner {
  private readonly cookieName: string;
  private readonly sessionTimeToLiveMs: number;
  private readonly signingSecret: string;
  private readonly secureCookie: boolean;
  private readonly now: () => number;
  private readonly randomBytesFactory: (size: number) => Buffer;

  public constructor(
    configuration: BrowserSessionAuthOwnerConfiguration,
    dependencies?: BrowserSessionAuthOwnerDependencies
  ) {
    const cookieName = configuration.cookieName.trim();
    if (cookieName.length === 0) {
      throw new Error("BrowserSessionAuthOwner requires a non-empty cookieName");
    }
    if (!Number.isInteger(configuration.sessionTimeToLiveMs) || configuration.sessionTimeToLiveMs <= 0) {
      throw new Error("BrowserSessionAuthOwner requires a positive integer sessionTimeToLiveMs");
    }
    const signingSecret = configuration.signingSecret.trim();
    if (signingSecret.length === 0) {
      throw new Error("BrowserSessionAuthOwner requires a non-empty signingSecret");
    }

    this.cookieName = cookieName;
    this.sessionTimeToLiveMs = configuration.sessionTimeToLiveMs;
    this.signingSecret = signingSecret;
    this.secureCookie = configuration.secureCookie;
    this.now = dependencies?.now ?? (() => Date.now());
    this.randomBytesFactory = dependencies?.randomBytesFactory ?? ((size) => randomBytes(size));
  }

  public issueSessionCookie(): BrowserSessionIssueResult {
    const issuedAtMs = this.now();
    const expiresAtMs = issuedAtMs + this.sessionTimeToLiveMs;
    const nonce = this.randomBytesFactory(18).toString("base64url");
    const payload = this.buildPayload(issuedAtMs, expiresAtMs, nonce);
    const signature = this.sign(payload);
    const token = `${payload}.${signature}`;
    const expiresAt = new Date(expiresAtMs).toISOString();

    return {
      setCookieHeaderValue: this.buildSetCookieHeaderValue(token, expiresAtMs),
      expiresAt
    };
  }

  public readSession(cookieHeaderValue: string | null): BrowserSessionReadResult {
    if (!cookieHeaderValue) {
      return {
        authenticated: false,
        expiresAt: null
      };
    }

    const sessionToken = this.readCookieValue(cookieHeaderValue, this.cookieName);
    if (!sessionToken) {
      return {
        authenticated: false,
        expiresAt: null
      };
    }

    const parsedSessionToken = this.parseSessionToken(sessionToken);
    if (!parsedSessionToken) {
      return {
        authenticated: false,
        expiresAt: null
      };
    }

    const payload = this.buildPayload(
      parsedSessionToken.issuedAtMs,
      parsedSessionToken.expiresAtMs,
      parsedSessionToken.nonce
    );
    const expectedSignature = this.sign(payload);
    if (!this.signaturesMatch(parsedSessionToken.signature, expectedSignature)) {
      return {
        authenticated: false,
        expiresAt: null
      };
    }

    if (this.now() >= parsedSessionToken.expiresAtMs) {
      return {
        authenticated: false,
        expiresAt: null
      };
    }

    return {
      authenticated: true,
      expiresAt: new Date(parsedSessionToken.expiresAtMs).toISOString()
    };
  }

  private buildSetCookieHeaderValue(token: string, expiresAtMs: number): string {
    const maxAgeSeconds = Math.floor(this.sessionTimeToLiveMs / 1_000);
    const directives = [
      `${this.cookieName}=${token}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${String(maxAgeSeconds)}`,
      `Expires=${new Date(expiresAtMs).toUTCString()}`
    ];
    if (this.secureCookie) {
      directives.push("Secure");
    }
    return directives.join("; ");
  }

  private readCookieValue(cookieHeaderValue: string, cookieName: string): string | null {
    const segments = cookieHeaderValue.split(";");
    for (const segment of segments) {
      const equalsIndex = segment.indexOf("=");
      if (equalsIndex <= 0) {
        continue;
      }
      const name = segment.slice(0, equalsIndex).trim();
      if (name !== cookieName) {
        continue;
      }
      const value = segment.slice(equalsIndex + 1).trim();
      if (value.length === 0) {
        return null;
      }
      return value;
    }
    return null;
  }

  private parseSessionToken(token: string): ParsedSessionToken | null {
    const parts = token.split(".");
    if (parts.length !== 4) {
      return null;
    }

    const issuedAtRaw = parts[0];
    const expiresAtRaw = parts[1];
    const nonce = parts[2];
    const signature = parts[3];
    if (!issuedAtRaw || !expiresAtRaw || !nonce || !signature) {
      return null;
    }

    const issuedAtMs = Number(issuedAtRaw);
    const expiresAtMs = Number(expiresAtRaw);
    if (
      !Number.isInteger(issuedAtMs)
      || !Number.isInteger(expiresAtMs)
      || issuedAtMs <= 0
      || expiresAtMs <= issuedAtMs
    ) {
      return null;
    }

    return {
      issuedAtMs,
      expiresAtMs,
      nonce,
      signature
    };
  }

  private buildPayload(issuedAtMs: number, expiresAtMs: number, nonce: string): string {
    return `${String(issuedAtMs)}.${String(expiresAtMs)}.${nonce}`;
  }

  private sign(payload: string): string {
    return createHmac("sha256", this.signingSecret)
      .update(payload)
      .digest("base64url");
  }

  private signaturesMatch(receivedSignature: string, expectedSignature: string): boolean {
    const receivedSignatureBuffer = Buffer.from(receivedSignature, "utf8");
    const expectedSignatureBuffer = Buffer.from(expectedSignature, "utf8");
    if (receivedSignatureBuffer.length !== expectedSignatureBuffer.length) {
      return false;
    }
    return timingSafeEqual(receivedSignatureBuffer, expectedSignatureBuffer);
  }
}

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const SESSION_TOKEN_PART_DELIMITER = ".";
const COOKIE_HEADER_SEGMENT_DELIMITER = ";";
const SET_COOKIE_DIRECTIVE_DELIMITER = "; ";
const SESSION_TOKEN_PART_COUNT = 4;
const SESSION_NONCE_RANDOM_BYTE_LENGTH = 18;
const MINIMUM_MAX_AGE_SECONDS = 1;
const MILLISECONDS_PER_SECOND = 1_000;

const SetCookieDirectiveByName = {
  path: "Path=/",
  httpOnly: "HttpOnly",
  sameSiteLax: "SameSite=Lax",
  secure: "Secure"
} as const;

const BrowserSessionAuthOwnerConfigurationErrorMessageByName = {
  missingCookieName: "BrowserSessionAuthOwner requires a non-empty cookieName",
  invalidSessionTimeToLiveMs: "BrowserSessionAuthOwner requires a positive integer sessionTimeToLiveMs",
  missingSigningSecret: "BrowserSessionAuthOwner requires a non-empty signingSecret",
  invalidSecureCookie: "BrowserSessionAuthOwner requires secureCookie to be a boolean"
} as const;

const CookieNameConfigurationSchema = z.string().trim().min(1);
const SessionTimeToLiveMillisecondsConfigurationSchema = z.number().int().positive();
const SigningSecretConfigurationSchema = z.string().trim().min(1);
const SecureCookieConfigurationSchema = z.boolean();

const Base64UrlTokenSegmentSchema = z.string().trim().min(1).regex(/^[A-Za-z0-9_-]+$/);
const SessionTimestampTokenSegmentSchema = z
  .string()
  .regex(/^[0-9]+$/)
  .transform((value) => Number(value))
  .pipe(z.number().int().positive());
const SessionTokenPartsSchema = z
  .tuple([
    SessionTimestampTokenSegmentSchema,
    SessionTimestampTokenSegmentSchema,
    Base64UrlTokenSegmentSchema,
    Base64UrlTokenSegmentSchema
  ])
  .superRefine(([issuedAtMs, expiresAtMs], context) => {
    if (expiresAtMs <= issuedAtMs) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Session expiry must be greater than issue timestamp",
        path: [1]
      });
    }
  });

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

/**
 * Owns browser-session cookie issuance and verification using signed self-contained tokens.
 * Token format is `<issuedAtMs>.<expiresAtMs>.<nonce>.<signature>`.
 */
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
    const parsedCookieName = CookieNameConfigurationSchema.safeParse(configuration.cookieName);
    if (!parsedCookieName.success) {
      throw new Error(BrowserSessionAuthOwnerConfigurationErrorMessageByName.missingCookieName);
    }
    const parsedSessionTimeToLiveMilliseconds = SessionTimeToLiveMillisecondsConfigurationSchema.safeParse(
      configuration.sessionTimeToLiveMs
    );
    if (!parsedSessionTimeToLiveMilliseconds.success) {
      throw new Error(BrowserSessionAuthOwnerConfigurationErrorMessageByName.invalidSessionTimeToLiveMs);
    }
    const parsedSigningSecret = SigningSecretConfigurationSchema.safeParse(configuration.signingSecret);
    if (!parsedSigningSecret.success) {
      throw new Error(BrowserSessionAuthOwnerConfigurationErrorMessageByName.missingSigningSecret);
    }
    const parsedSecureCookie = SecureCookieConfigurationSchema.safeParse(configuration.secureCookie);
    if (!parsedSecureCookie.success) {
      throw new Error(BrowserSessionAuthOwnerConfigurationErrorMessageByName.invalidSecureCookie);
    }

    this.cookieName = parsedCookieName.data;
    this.sessionTimeToLiveMs = parsedSessionTimeToLiveMilliseconds.data;
    this.signingSecret = parsedSigningSecret.data;
    this.secureCookie = parsedSecureCookie.data;
    this.now = dependencies?.now ?? (() => Date.now());
    this.randomBytesFactory = dependencies?.randomBytesFactory ?? ((size) => randomBytes(size));
  }

  public issueSessionCookie(): BrowserSessionIssueResult {
    const issuedAtMs = this.now();
    const expiresAtMs = issuedAtMs + this.sessionTimeToLiveMs;
    const nonce = this.randomBytesFactory(SESSION_NONCE_RANDOM_BYTE_LENGTH).toString("base64url");
    const payload = this.buildPayload(issuedAtMs, expiresAtMs, nonce);
    const signature = this.sign(payload);
    const token = `${payload}${SESSION_TOKEN_PART_DELIMITER}${signature}`;
    const expiresAt = this.buildIsoTimestamp(expiresAtMs);

    return {
      setCookieHeaderValue: this.buildSetCookieHeaderValue(token, expiresAtMs),
      expiresAt
    };
  }

  public readSession(cookieHeaderValue: string | null): BrowserSessionReadResult {
    if (cookieHeaderValue === null || cookieHeaderValue.length === 0) {
      return this.buildUnauthenticatedReadResult();
    }

    const sessionToken = this.readCookieValue(cookieHeaderValue);
    if (sessionToken === null || sessionToken.length === 0) {
      return this.buildUnauthenticatedReadResult();
    }

    const parsedSessionToken = this.parseSessionToken(sessionToken);
    if (!parsedSessionToken) {
      return this.buildUnauthenticatedReadResult();
    }

    const payload = this.buildPayload(
      parsedSessionToken.issuedAtMs,
      parsedSessionToken.expiresAtMs,
      parsedSessionToken.nonce
    );
    const expectedSignature = this.sign(payload);
    if (!this.signaturesMatch(parsedSessionToken.signature, expectedSignature)) {
      return this.buildUnauthenticatedReadResult();
    }

    if (this.now() >= parsedSessionToken.expiresAtMs) {
      return this.buildUnauthenticatedReadResult();
    }

    return this.buildAuthenticatedReadResult(parsedSessionToken.expiresAtMs);
  }

  private buildSetCookieHeaderValue(token: string, expiresAtMs: number): string {
    // Browsers treat Max-Age=0 as immediate expiry, so keep a minimum one-second lifetime.
    const maxAgeSeconds = Math.max(
      MINIMUM_MAX_AGE_SECONDS,
      Math.floor(this.sessionTimeToLiveMs / MILLISECONDS_PER_SECOND)
    );
    const directives = [
      `${this.cookieName}=${token}`,
      SetCookieDirectiveByName.path,
      SetCookieDirectiveByName.httpOnly,
      SetCookieDirectiveByName.sameSiteLax,
      `Max-Age=${String(maxAgeSeconds)}`,
      `Expires=${this.buildUtcTimestamp(expiresAtMs)}`
    ];
    if (this.secureCookie) {
      directives.push(SetCookieDirectiveByName.secure);
    }
    return directives.join(SET_COOKIE_DIRECTIVE_DELIMITER);
  }

  private readCookieValue(cookieHeaderValue: string): string | null {
    const segments = cookieHeaderValue.split(COOKIE_HEADER_SEGMENT_DELIMITER);
    for (const segment of segments) {
      const equalsIndex = segment.indexOf("=");
      if (equalsIndex <= 0) {
        continue;
      }
      const name = segment.slice(0, equalsIndex).trim();
      if (name !== this.cookieName) {
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
    const parts = token.split(SESSION_TOKEN_PART_DELIMITER);
    if (parts.length !== SESSION_TOKEN_PART_COUNT) {
      return null;
    }
    const parsedSessionTokenParts = SessionTokenPartsSchema.safeParse(parts);
    if (!parsedSessionTokenParts.success) {
      return null;
    }
    const [issuedAtMs, expiresAtMs, nonce, signature] = parsedSessionTokenParts.data;

    return {
      issuedAtMs,
      expiresAtMs,
      nonce,
      signature
    };
  }

  private buildPayload(issuedAtMs: number, expiresAtMs: number, nonce: string): string {
    return `${String(issuedAtMs)}${SESSION_TOKEN_PART_DELIMITER}${String(expiresAtMs)}${SESSION_TOKEN_PART_DELIMITER}${nonce}`;
  }

  private buildAuthenticatedReadResult(expiresAtMs: number): BrowserSessionReadResult {
    return {
      authenticated: true,
      expiresAt: this.buildIsoTimestamp(expiresAtMs)
    };
  }

  private buildUnauthenticatedReadResult(): BrowserSessionReadResult {
    return {
      authenticated: false,
      expiresAt: null
    };
  }

  private buildIsoTimestamp(timestampMilliseconds: number): string {
    return new Date(timestampMilliseconds).toISOString();
  }

  private buildUtcTimestamp(timestampMilliseconds: number): string {
    return new Date(timestampMilliseconds).toUTCString();
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

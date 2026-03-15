import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRUSTED_DEVELOPMENT_PROXY_ORIGINS,
  parseTrustedDevelopmentProxyOrigins,
  shouldInjectApiTokenForDevelopmentProxy,
} from "@/Application/Configuration/DevelopmentProxyTrustPolicy";

describe("DevelopmentProxyTrustPolicy", () => {
  it("includes loopback development origins by default", () => {
    expect(DEFAULT_TRUSTED_DEVELOPMENT_PROXY_ORIGINS).toEqual(
      new Set(["http://localhost:4312", "http://127.0.0.1:4312", "http://[::1]:4312"]),
    );
    expect(parseTrustedDevelopmentProxyOrigins(undefined)).toEqual(
      DEFAULT_TRUSTED_DEVELOPMENT_PROXY_ORIGINS,
    );
  });

  it("builds loopback development origins for an alternate dev port", () => {
    expect(parseTrustedDevelopmentProxyOrigins(undefined, 4322)).toEqual(
      new Set(["http://localhost:4322", "http://127.0.0.1:4322", "http://[::1]:4322"]),
    );
  });

  it("parses explicit trusted origins with normalization", () => {
    expect(
      parseTrustedDevelopmentProxyOrigins(" HTTP://192.168.7.56:4312,https://phone.example.test "),
    ).toEqual(new Set(["http://192.168.7.56:4312", "https://phone.example.test"]));
  });

  it("injects token for loopback requests without an origin header", () => {
    expect(
      shouldInjectApiTokenForDevelopmentProxy({
        apiToken: "token",
        originHeader: undefined,
        hostHeader: "127.0.0.1:4312",
        remoteAddress: "127.0.0.1",
        trustedOrigins: DEFAULT_TRUSTED_DEVELOPMENT_PROXY_ORIGINS,
      }),
    ).toBe(true);
  });

  it("does not inject token for non-loopback requests without an origin header", () => {
    expect(
      shouldInjectApiTokenForDevelopmentProxy({
        apiToken: "token",
        originHeader: undefined,
        hostHeader: "192.168.7.56:4312",
        remoteAddress: "192.168.7.21",
        trustedOrigins: DEFAULT_TRUSTED_DEVELOPMENT_PROXY_ORIGINS,
      }),
    ).toBe(false);
  });

  it("does not inject token for same-host browser requests unless the origin is explicitly trusted", () => {
    expect(
      shouldInjectApiTokenForDevelopmentProxy({
        apiToken: "token",
        originHeader: "http://192.168.7.56:4312",
        hostHeader: "192.168.7.56:4312",
        remoteAddress: "192.168.7.21",
        trustedOrigins: DEFAULT_TRUSTED_DEVELOPMENT_PROXY_ORIGINS,
      }),
    ).toBe(false);
  });

  it("injects token for explicitly trusted non-localhost origins", () => {
    expect(
      shouldInjectApiTokenForDevelopmentProxy({
        apiToken: "token",
        originHeader: "https://farfield-phone.local",
        hostHeader: "127.0.0.1:4312",
        remoteAddress: "192.168.7.21",
        trustedOrigins: parseTrustedDevelopmentProxyOrigins("https://farfield-phone.local"),
      }),
    ).toBe(true);
  });

  it("does not inject token for remote callers that spoof loopback trusted origins", () => {
    expect(
      shouldInjectApiTokenForDevelopmentProxy({
        apiToken: "token",
        originHeader: "http://localhost:4312",
        hostHeader: "192.168.7.56:4312",
        remoteAddress: "192.168.7.21",
        trustedOrigins: DEFAULT_TRUSTED_DEVELOPMENT_PROXY_ORIGINS,
      }),
    ).toBe(false);
  });

  it("does not inject token for cross-origin remote requests", () => {
    expect(
      shouldInjectApiTokenForDevelopmentProxy({
        apiToken: "token",
        originHeader: "https://evil.example.test",
        hostHeader: "192.168.7.56:4312",
        remoteAddress: "192.168.7.21",
        trustedOrigins: DEFAULT_TRUSTED_DEVELOPMENT_PROXY_ORIGINS,
      }),
    ).toBe(false);
  });
});

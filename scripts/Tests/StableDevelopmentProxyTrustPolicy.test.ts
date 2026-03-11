import { describe, expect, it } from "vitest";
import {
  buildStableDevelopmentDefaultTrustedOrigins,
  parseStableDevelopmentTrustedOrigins,
  shouldInjectApiTokenForStableDevelopmentProxy,
} from "../development/StableDevelopmentProxyTrustPolicy.mjs";

describe("StableDevelopmentProxyTrustPolicy", () => {
  it("includes stable-development loopback origins by default", () => {
    expect(buildStableDevelopmentDefaultTrustedOrigins(4312)).toEqual(
      new Set(["http://localhost:4312", "http://127.0.0.1:4312", "http://[::1]:4312"]),
    );
  });

  it("parses explicit trusted origins", () => {
    expect(
      parseStableDevelopmentTrustedOrigins(
        " http://192.168.7.56:5512,https://phone.example.test ",
        5512,
      ),
    ).toEqual(new Set(["http://192.168.7.56:5512", "https://phone.example.test"]));
  });

  it("injects the token for loopback originless requests", () => {
    expect(
      shouldInjectApiTokenForStableDevelopmentProxy({
        apiToken: "token",
        originHeader: undefined,
        hostHeader: "127.0.0.1:4312",
        remoteAddress: "127.0.0.1",
        trustedOrigins: buildStableDevelopmentDefaultTrustedOrigins(4312),
      }),
    ).toBe(true);
  });

  it("rejects same-host browser requests unless the origin is explicitly trusted", () => {
    expect(
      shouldInjectApiTokenForStableDevelopmentProxy({
        apiToken: "token",
        originHeader: "http://192.168.7.56:4312",
        hostHeader: "192.168.7.56:4312",
        remoteAddress: "192.168.7.10",
        trustedOrigins: buildStableDevelopmentDefaultTrustedOrigins(4312),
      }),
    ).toBe(false);
  });

  it("rejects untrusted cross-origin browser requests", () => {
    expect(
      shouldInjectApiTokenForStableDevelopmentProxy({
        apiToken: "token",
        originHeader: "https://evil.example.test",
        hostHeader: "192.168.7.56:4312",
        remoteAddress: "192.168.7.10",
        trustedOrigins: buildStableDevelopmentDefaultTrustedOrigins(4312),
      }),
    ).toBe(false);
  });
});

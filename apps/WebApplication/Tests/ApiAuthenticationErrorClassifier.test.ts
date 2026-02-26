import { describe, expect, it } from "vitest";
import { ApiAuthenticationErrorClassifier } from "@/Application/DomainModel/ApiAuthenticationErrorClassifier";

describe("ApiAuthenticationErrorClassifier", () => {
  it("matches token-authentication errors regardless of casing and whitespace", () => {
    const classifier = new ApiAuthenticationErrorClassifier();

    expect(
      classifier.isApiTokenAuthenticationError("  unauthorized: missing or invalid X-Farfield-Token  ")
    ).toBe(true);
  });

  it("does not match unrelated errors", () => {
    const classifier = new ApiAuthenticationErrorClassifier();

    expect(classifier.isApiTokenAuthenticationError("Unauthorized: session expired")).toBe(false);
  });
});

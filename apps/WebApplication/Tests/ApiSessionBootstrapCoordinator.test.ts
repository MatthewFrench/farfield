import { describe, expect, it, vi } from "vitest";
import { ApiSessionBootstrapCoordinator } from "@/Application/StateManagement/ApiSessionBootstrapCoordinator";

describe("ApiSessionBootstrapCoordinator", () => {
  it("caches non-authenticated mode after first successful bootstrap read", async () => {
    const coordinator = new ApiSessionBootstrapCoordinator();
    const readSession = vi.fn(async () => ({
      authRequired: false,
      bootstrapped: true,
      expiresAt: null
    }));

    expect(await coordinator.ensureSession(readSession, 1_000)).toEqual({
      isReady: true,
      requiresApiToken: false
    });
    expect(await coordinator.ensureSession(readSession, 2_000)).toEqual({
      isReady: true,
      requiresApiToken: false
    });

    expect(readSession).toHaveBeenCalledTimes(1);
  });

  it("requires api token after protected bootstrap reports not bootstrapped", async () => {
    const coordinator = new ApiSessionBootstrapCoordinator();
    const readSession = vi.fn(async () => ({
      authRequired: true,
      bootstrapped: false,
      expiresAt: null
    }));

    expect(await coordinator.ensureSession(readSession, 1_000)).toEqual({
      isReady: false,
      requiresApiToken: true
    });
    expect(await coordinator.ensureSession(readSession, 2_000)).toEqual({
      isReady: false,
      requiresApiToken: true
    });

    expect(readSession).toHaveBeenCalledTimes(1);
  });

  it("accepts api token bootstrap and keeps session ready until refresh threshold", async () => {
    const refreshLeadTimeMs = 1_000;
    const coordinator = new ApiSessionBootstrapCoordinator(refreshLeadTimeMs);
    const initialRead = vi.fn(async () => ({
      authRequired: true,
      bootstrapped: false,
      expiresAt: null
    }));
    const readWithApiToken = vi.fn(async (_apiToken: string) => ({
      authRequired: true,
      bootstrapped: true,
      expiresAt: "2099-01-01T00:00:20.000Z"
    }));
    const steadyStateRead = vi.fn(async () => ({
      authRequired: true,
      bootstrapped: true,
      expiresAt: "2099-01-01T00:00:20.000Z"
    }));
    const nearExpiryRead = vi.fn(async () => ({
      authRequired: true,
      bootstrapped: true,
      expiresAt: "2099-01-01T00:00:40.000Z"
    }));
    const firstExpiryEpochMs = Date.parse("2099-01-01T00:00:20.000Z");

    expect(await coordinator.ensureSession(initialRead)).toEqual({
      isReady: false,
      requiresApiToken: true
    });
    expect(await coordinator.submitApiToken("token-123", readWithApiToken)).toEqual({
      isReady: true,
      requiresApiToken: false
    });
    expect(await coordinator.ensureSession(steadyStateRead, firstExpiryEpochMs - refreshLeadTimeMs - 1)).toEqual({
      isReady: true,
      requiresApiToken: false
    });
    expect(await coordinator.ensureSession(nearExpiryRead, firstExpiryEpochMs - refreshLeadTimeMs + 1)).toEqual({
      isReady: true,
      requiresApiToken: false
    });

    expect(initialRead).toHaveBeenCalledTimes(1);
    expect(readWithApiToken).toHaveBeenCalledTimes(1);
    expect(steadyStateRead).toHaveBeenCalledTimes(0);
    expect(nearExpiryRead).toHaveBeenCalledTimes(1);
  });

  it("keeps session ready inside refresh lead-time while triggering non-blocking refresh", async () => {
    const refreshLeadTimeMs = 30_000;
    const coordinator = new ApiSessionBootstrapCoordinator(refreshLeadTimeMs);
    const expiresAt = "2099-01-01T00:00:20.000Z";
    const expiresAtEpochMs = Date.parse(expiresAt);

    const initializeRead = vi.fn(async () => ({
      authRequired: true,
      bootstrapped: true,
      expiresAt
    }));
    const nearExpiryRefreshRead = vi.fn(async () => ({
      authRequired: true,
      bootstrapped: true,
      expiresAt
    }));

    expect(await coordinator.ensureSession(initializeRead, expiresAtEpochMs - refreshLeadTimeMs - 1)).toEqual({
      isReady: true,
      requiresApiToken: false
    });

    expect(await coordinator.ensureSession(nearExpiryRefreshRead, expiresAtEpochMs - refreshLeadTimeMs + 1)).toEqual({
      isReady: true,
      requiresApiToken: false
    });

    expect(initializeRead).toHaveBeenCalledTimes(1);
    expect(nearExpiryRefreshRead).toHaveBeenCalledTimes(1);
  });

  it("honors explicit api-token-required marker without issuing requests", async () => {
    const coordinator = new ApiSessionBootstrapCoordinator();
    const readSession = vi.fn(async () => ({
      authRequired: true,
      bootstrapped: true,
      expiresAt: "2099-01-01T00:00:20.000Z"
    }));

    coordinator.markApiTokenRequired();
    expect(await coordinator.ensureSession(readSession)).toEqual({
      isReady: false,
      requiresApiToken: true
    });

    expect(readSession).toHaveBeenCalledTimes(0);
  });
});

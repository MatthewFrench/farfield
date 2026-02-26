import { describe, expect, it, vi } from "vitest";
import {
  ApiSessionBootstrapCoordinator,
  type ApiSessionBootstrapResponse
} from "@/Application/StateManagement/ApiSessionBootstrapCoordinator";

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

  it("consumes background refresh rejection and retries on later refresh attempts", async () => {
    const refreshLeadTimeMs = 30_000;
    const coordinator = new ApiSessionBootstrapCoordinator(refreshLeadTimeMs);
    const expiresAt = "2099-01-01T00:00:20.000Z";
    const expiresAtEpochMs = Date.parse(expiresAt);

    const initializeRead = vi.fn(async () => ({
      authRequired: true,
      bootstrapped: true,
      expiresAt
    }));

    let rejectBackgroundRefresh: (error: Error) => void = () => {
      throw new Error("Expected background refresh reject callback to be initialized");
    };
    const failingBackgroundRefreshRead = vi.fn(
      () =>
        new Promise<ApiSessionBootstrapResponse>((_resolve, reject) => {
          rejectBackgroundRefresh = (error: Error) => {
            reject(error);
          };
        })
    );

    const succeedingBackgroundRefreshRead = vi.fn(async () => ({
      authRequired: true,
      bootstrapped: true,
      expiresAt
    }));

    expect(await coordinator.ensureSession(initializeRead, expiresAtEpochMs - refreshLeadTimeMs - 1)).toEqual({
      isReady: true,
      requiresApiToken: false
    });

    expect(await coordinator.ensureSession(failingBackgroundRefreshRead, expiresAtEpochMs - refreshLeadTimeMs + 1)).toEqual({
      isReady: true,
      requiresApiToken: false
    });

    rejectBackgroundRefresh(new Error("refresh-error"));
    await Promise.resolve();
    await Promise.resolve();

    expect(await coordinator.ensureSession(succeedingBackgroundRefreshRead, expiresAtEpochMs - refreshLeadTimeMs + 2)).toEqual({
      isReady: true,
      requiresApiToken: false
    });

    expect(initializeRead).toHaveBeenCalledTimes(1);
    expect(failingBackgroundRefreshRead).toHaveBeenCalledTimes(1);
    expect(succeedingBackgroundRefreshRead).toHaveBeenCalledTimes(1);
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

  it("coalesces concurrent bootstrap requests into one in-flight read", async () => {
    const coordinator = new ApiSessionBootstrapCoordinator();
    let resolveBootstrapRead: (response: ApiSessionBootstrapResponse) => void = () => {
      throw new Error("Expected bootstrap resolver to be initialized");
    };
    const readSession = vi.fn(() =>
      new Promise<ApiSessionBootstrapResponse>((resolve) => {
        resolveBootstrapRead = resolve;
      })
    );

    const firstDecisionPromise = coordinator.ensureSession(readSession, 1_000);
    const secondDecisionPromise = coordinator.ensureSession(readSession, 1_000);

    expect(readSession).toHaveBeenCalledTimes(1);
    resolveBootstrapRead({
      authRequired: false,
      bootstrapped: true,
      expiresAt: null
    });

    await expect(firstDecisionPromise).resolves.toEqual({
      isReady: true,
      requiresApiToken: false
    });
    await expect(secondDecisionPromise).resolves.toEqual({
      isReady: true,
      requiresApiToken: false
    });
  });

  it("rejects empty api tokens before attempting bootstrap", async () => {
    const coordinator = new ApiSessionBootstrapCoordinator();
    const readWithApiToken = vi.fn(async (_apiToken: string) => ({
      authRequired: true,
      bootstrapped: true,
      expiresAt: "2099-01-01T00:00:20.000Z"
    }));

    await expect(coordinator.submitApiToken("   ", readWithApiToken)).rejects.toThrowError("API token is required");
    expect(readWithApiToken).toHaveBeenCalledTimes(0);
  });

  it("trims api token values before submitting bootstrap requests", async () => {
    const coordinator = new ApiSessionBootstrapCoordinator();
    const readWithApiToken = vi.fn(async (_apiToken: string) => ({
      authRequired: false,
      bootstrapped: true,
      expiresAt: null
    }));

    await expect(coordinator.submitApiToken("  token-123  ", readWithApiToken)).resolves.toEqual({
      isReady: true,
      requiresApiToken: false
    });

    expect(readWithApiToken).toHaveBeenCalledWith("token-123");
    expect(readWithApiToken).toHaveBeenCalledTimes(1);
  });

  it("throws when a bootstrapped protected session has an invalid expiresAt value", async () => {
    const coordinator = new ApiSessionBootstrapCoordinator();
    const readSession = vi.fn(async () => ({
      authRequired: true,
      bootstrapped: true,
      expiresAt: "invalid-date-value"
    }));

    await expect(coordinator.ensureSession(readSession, 1_000)).rejects.toThrowError(
      "ApiSessionBootstrapCoordinator received an invalid expiresAt value: invalid-date-value"
    );
    expect(readSession).toHaveBeenCalledTimes(1);
  });
});

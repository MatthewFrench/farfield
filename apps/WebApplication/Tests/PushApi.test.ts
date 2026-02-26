import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getPushStatus,
  getPushVapidPublicKey,
  sendPushTestNotification
} from "@/Features/PushNotifications/DataAccess/PushApi";
import { type StructuredDataValue } from "@/Shared/Contracts/StructuredDataValue";

function createJsonResponse(body: StructuredDataValue): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PushApi", () => {
  it("normalizes push status responses by removing transport envelope fields", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        ok: true,
        enabled: true,
        permissionRequired: true,
        subscriptionCount: 3,
        privateModeDefault: false
      })
    );

    const pushStatusResponse = await getPushStatus();

    expect(pushStatusResponse).toEqual({
      enabled: true,
      permissionRequired: true,
      subscriptionCount: 3,
      privateModeDefault: false
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("normalizes push VAPID public key responses by removing transport envelope fields", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        ok: true,
        publicKey:
          "BPItc9n5cEBFiYtrIgv4iMahikEkQeXwdD4Q9MTDmTrU4Ty-pj1_XqHdL0pF-RQVUKS_k7_C5P_rXX6crzWkL2U"
      })
    );

    const pushVapidPublicKeyResponse = await getPushVapidPublicKey();

    expect(pushVapidPublicKeyResponse).toEqual({
      publicKey:
        "BPItc9n5cEBFiYtrIgv4iMahikEkQeXwdD4Q9MTDmTrU4Ty-pj1_XqHdL0pF-RQVUKS_k7_C5P_rXX6crzWkL2U"
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects push status responses when envelope fields fail schema validation", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        ok: true,
        enabled: true,
        permissionRequired: true,
        subscriptionCount: -1,
        privateModeDefault: false
      })
    );

    await expect(getPushStatus()).rejects.toThrowError();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects push-test payloads with blank thread identifiers before issuing a request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(
      sendPushTestNotification({
        threadId: "   ",
        turnId: "turn-1"
      })
    ).rejects.toThrowError();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects push-test payloads with blank turn identifiers before issuing a request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(
      sendPushTestNotification({
        threadId: "thread-1",
        turnId: "   "
      })
    ).rejects.toThrowError();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

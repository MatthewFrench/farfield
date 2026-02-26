import { describe, expect, it } from "vitest";
import {
  parsePushReceiptStore,
  parsePushSendStore,
  parsePushStateStore,
  PushReceiptEventSchema,
  parseVapidPublicKeyResponse
} from "../Source/Index.js";

describe("codex-protocol push schemas", () => {
  it("migrates legacy push receipt stores to the current contract", () => {
    const parsed = parsePushReceiptStore({
      version: 1,
      receipts: [
        {
          event: "shown",
          url: "https://farfield.dev/thread/thread-1",
          threadId: "thread-1",
          turnId: "turn-1",
          message: null,
          createdAt: "2026-02-26T00:00:00.000Z"
        }
      ]
    });

    expect(parsed.version).toBe(2);
    expect(parsed.receipts[0]?.notificationId).toBe("legacy-1-2026-02-26T00:00:00.000Z");
  });

  it("rejects push receipt stores with unsupported versions", () => {
    expect(() =>
      parsePushReceiptStore({
        version: 3,
        receipts: []
      })
    ).toThrowError(/PushReceiptStore did not match expected schema/);
  });

  it("rejects push state stores when version policy is violated", () => {
    expect(() =>
      parsePushStateStore({
        version: 2,
        subscriptions: [],
        completionWatermarks: []
      })
    ).toThrowError(/Unsupported push state version: 2/);
  });

  it("rejects push send stores when version policy is violated", () => {
    expect(() =>
      parsePushSendStore({
        version: 2,
        latest: null
      })
    ).toThrowError(/Unsupported push send store version: 2/);
  });

  it("assigns deterministic identifiers while migrating multiple legacy receipts", () => {
    const legacyStore = {
      version: 1,
      receipts: [
        {
          event: "shown",
          url: "https://farfield.dev/thread/thread-1",
          threadId: "thread-1",
          turnId: "turn-1",
          message: null,
          createdAt: "2026-02-26T00:00:00.000Z"
        },
        {
          event: "clicked",
          url: "https://farfield.dev/thread/thread-2",
          threadId: "thread-2",
          turnId: "turn-2",
          message: "opened",
          createdAt: "2026-02-26T00:01:00.000Z"
        }
      ]
    } as const;

    const firstParse = parsePushReceiptStore(legacyStore);
    const secondParse = parsePushReceiptStore(legacyStore);

    expect(firstParse.receipts.map((receipt) => receipt.notificationId)).toEqual([
      "legacy-1-2026-02-26T00:00:00.000Z",
      "legacy-2-2026-02-26T00:01:00.000Z"
    ]);
    expect(secondParse.receipts.map((receipt) => receipt.notificationId)).toEqual([
      "legacy-1-2026-02-26T00:00:00.000Z",
      "legacy-2-2026-02-26T00:01:00.000Z"
    ]);
  });

  it("accepts only declared push receipt events", () => {
    expect(PushReceiptEventSchema.safeParse("clicked").success).toBe(true);
    expect(PushReceiptEventSchema.safeParse("dismissed").success).toBe(false);
  });

  it("parses and validates vapid public key contracts", () => {
    const parsed = parseVapidPublicKeyResponse({
      publicKey: "AbCdEf0123_-"
    });

    expect(parsed.publicKey).toBe("AbCdEf0123_-");
    expect(() =>
      parseVapidPublicKeyResponse({
        publicKey: "AbCdEf+/="
      })
    ).toThrowError(/Expected base64url value/);
  });
});

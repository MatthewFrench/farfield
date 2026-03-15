import { describe, expect, it } from "vitest";
import { resolveOwnerClientId } from "../Source/Modules/Threads/ThreadOwner.js";

describe("resolveOwnerClientId", () => {
  it("trims and prefers mapped owner when both owner sources are present", () => {
    const owners = new Map<string, string>();
    owners.set("thread-1", "  client-map  ");

    const owner = resolveOwnerClientId(owners, "thread-1", "  client-override  ");
    expect(owner).toBe("client-map");
  });

  it("uses mapped owner when both mapped owner and override are present", () => {
    const owners = new Map<string, string>();
    owners.set("thread-1", "client-map");

    const owner = resolveOwnerClientId(owners, "thread-1", "client-override");
    expect(owner).toBe("client-map");
  });

  it("uses explicit override when mapped owner is missing", () => {
    const owner = resolveOwnerClientId(new Map(), "thread-1", "client-override");
    expect(owner).toBe("client-override");
  });

  it("uses trimmed override when mapped owner value is blank", () => {
    const owners = new Map<string, string>();
    owners.set("thread-1", "   ");

    const owner = resolveOwnerClientId(owners, "thread-1", "  client-override  ");
    expect(owner).toBe("client-override");
  });

  it("uses mapped owner when override missing", () => {
    const owners = new Map<string, string>();
    owners.set("thread-1", "client-map");

    const owner = resolveOwnerClientId(owners, "thread-1");
    expect(owner).toBe("client-map");
  });

  it("throws when owner is unavailable", () => {
    expect(() => resolveOwnerClientId(new Map(), "thread-1")).toThrowError(/No owner client id/);
  });

  it("throws when owner sources are blank", () => {
    const owners = new Map<string, string>();
    owners.set("thread-1", "   ");

    expect(() => resolveOwnerClientId(owners, "thread-1", "   ")).toThrowError(
      /No owner client id/,
    );
  });
});

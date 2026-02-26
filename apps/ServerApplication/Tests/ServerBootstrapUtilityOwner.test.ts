import { IncomingMessage } from "node:http";
import { Socket } from "node:net";
import { describe, expect, it } from "vitest";
import { ServerBootstrapUtilityOwner } from "../Source/Application/Bootstrap/ServerBootstrapUtilityOwner.js";

class IncomingMessageStub extends IncomingMessage {
  public constructor(chunks: ReadonlyArray<string | Buffer>) {
    super(new Socket());
    for (const chunk of chunks) {
      this.push(chunk);
    }
    this.push(null);
  }
}

describe("ServerBootstrapUtilityOwner", () => {
  it("parses JSON request bodies into schema-validated JSON values", async () => {
    const owner = new ServerBootstrapUtilityOwner();
    const request = new IncomingMessageStub([
      Buffer.from("{", "utf8"),
      "\"payload\":",
      "{\"enabled\":true,\"count\":3}",
      "}"
    ]);

    const parsed = await owner.readJsonBody(request);

    expect(parsed).toEqual({
      payload: {
        enabled: true,
        count: 3
      }
    });
  });

  it("returns an empty object for empty request payloads", async () => {
    const owner = new ServerBootstrapUtilityOwner();
    const request = new IncomingMessageStub([]);

    const parsed = await owner.readJsonBody(request);

    expect(parsed).toEqual({});
  });

  it("throws when request payload is malformed JSON", async () => {
    const owner = new ServerBootstrapUtilityOwner();
    const request = new IncomingMessageStub(["{ \"payload\":"]);

    await expect(owner.readJsonBody(request)).rejects.toThrow();
  });
});

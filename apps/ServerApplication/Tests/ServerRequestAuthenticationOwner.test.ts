import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { describe, expect, it } from "vitest";
import { BrowserSessionAuthOwner } from "../Source/Network/BrowserSessionAuthOwner.js";
import { ServerRequestAuthenticationOwner } from "../Source/Network/ServerRequestAuthenticationOwner.js";

describe("ServerRequestAuthenticationOwner", () => {
  it("requires authentication for double-slash api paths", () => {
    const socket = new Socket();
    const request = new IncomingMessage(socket);
    const response = new ServerResponse(request);
    let responseStatusCode: number | null = null;
    let responseBody: object | null = null;
    const owner = new ServerRequestAuthenticationOwner({
      apiAuthRequired: true,
      apiToken: "token",
      apiTokenHeaderName: "x-farfield-token",
      apiTokenResponseHeader: "X-Farfield-Token",
      browserSessionAuthOwner: new BrowserSessionAuthOwner({
        cookieName: "farfield-session",
        sessionTimeToLiveMs: 60_000,
        signingSecret: "test-secret",
        secureCookie: false,
      }),
      jsonResponse: (_response, statusCode, body) => {
        responseStatusCode = statusCode;
        responseBody = body;
      },
      readHeader: () => null,
    });

    const allowed = owner.requireApiAuth(request, response, "//api/threads/thread-1/messages");

    expect(allowed).toBe(false);
    expect(responseStatusCode).toBe(401);
    expect(responseBody).toMatchObject({
      ok: false,
      error: "Unauthorized: missing or invalid X-Farfield-Token",
    });
  });
});

import fs from "node:fs";
import { IncomingMessage, type ServerResponse } from "node:http";
import { Socket } from "node:net";
import os from "node:os";
import path from "node:path";
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

class ServerResponseRecorder {
  public statusCode: number | null = null;
  public headers: Record<string, number | string | readonly string[]> | null = null;
  public body: Buffer | null = null;

  public writeHead(
    statusCode: number,
    headers: Record<string, number | string | readonly string[]>,
  ): void {
    this.statusCode = statusCode;
    this.headers = headers;
  }

  public end(chunk?: string | Buffer): void {
    this.body = chunk === undefined ? Buffer.alloc(0) : Buffer.from(chunk);
  }

  public asServerResponse(): ServerResponse {
    return this as ServerResponse;
  }
}

describe("ServerBootstrapUtilityOwner", () => {
  it("writes JSON responses with the bootstrap contract headers", () => {
    const owner = new ServerBootstrapUtilityOwner();
    const recorder = new ServerResponseRecorder();
    const body = {
      ok: true,
      message: "ready",
    };

    owner.jsonResponse(recorder.asServerResponse(), 200, body);

    const encodedBody = Buffer.from(JSON.stringify(body), "utf8");
    expect(recorder.statusCode).toBe(200);
    expect(recorder.headers).toEqual({
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": encodedBody.length,
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "content-type, x-farfield-token, x-farfield-request-id, x-farfield-action-id, x-farfield-action-name",
      "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    });
    expect(recorder.body).toEqual(encodedBody);
  });

  it("rejects invalid HTTP status codes for JSON responses", () => {
    const owner = new ServerBootstrapUtilityOwner();
    const recorder = new ServerResponseRecorder();

    expect(() => owner.jsonResponse(recorder.asServerResponse(), 99, {})).toThrow();
    expect(() => owner.jsonResponse(recorder.asServerResponse(), 600, {})).toThrow();
  });

  it("parses JSON request bodies into schema-validated JSON values", async () => {
    const owner = new ServerBootstrapUtilityOwner();
    const request = new IncomingMessageStub([
      Buffer.from("{", "utf8"),
      '"payload":',
      '{"enabled":true,"count":3}',
      "}",
    ]);

    const parsed = await owner.readJsonBody(request);

    expect(parsed).toEqual({
      payload: {
        enabled: true,
        count: 3,
      },
    });
  });

  it("returns an empty object for empty or blank request payloads", async () => {
    const owner = new ServerBootstrapUtilityOwner();
    const emptyRequest = new IncomingMessageStub([]);
    const blankRequest = new IncomingMessageStub(["  \n\t "]);

    const parsedEmptyRequest = await owner.readJsonBody(emptyRequest);
    const parsedBlankRequest = await owner.readJsonBody(blankRequest);

    expect(parsedEmptyRequest).toEqual({});
    expect(parsedBlankRequest).toEqual({});
  });

  it("throws an explicit error when request payload is malformed JSON", async () => {
    const owner = new ServerBootstrapUtilityOwner();
    const request = new IncomingMessageStub(['{ "payload":']);

    await expect(owner.readJsonBody(request)).rejects.toThrow("Request body must be valid JSON.");
  });

  it("throws an explicit error when request payload is a non-object JSON value", async () => {
    const owner = new ServerBootstrapUtilityOwner();

    await expect(owner.readJsonBody(new IncomingMessageStub(['"value"']))).rejects.toThrow(
      "Request body must be a JSON object.",
    );
    await expect(owner.readJsonBody(new IncomingMessageStub(["42"]))).rejects.toThrow(
      "Request body must be a JSON object.",
    );
    await expect(owner.readJsonBody(new IncomingMessageStub(["[1,2,3]"]))).rejects.toThrow(
      "Request body must be a JSON object.",
    );
    await expect(owner.readJsonBody(new IncomingMessageStub(["null"]))).rejects.toThrow(
      "Request body must be a JSON object.",
    );
  });

  it("normalizes diverse error inputs into messages", () => {
    const owner = new ServerBootstrapUtilityOwner();

    expect(owner.toErrorMessage(new Error("failure"))).toBe("failure");
    expect(owner.toErrorMessage("plain-error")).toBe("plain-error");
    expect(owner.toErrorMessage({ message: "structured-error" })).toBe("structured-error");
    expect(owner.toErrorMessage(404)).toBe("404");
    expect(owner.toErrorMessage(null)).toBe("null");
  });

  it("creates directories and remains idempotent", () => {
    const owner = new ServerBootstrapUtilityOwner();
    const temporaryDirectoryPath = fs.mkdtempSync(
      path.join(os.tmpdir(), "farfield-server-bootstrap-owner-"),
    );
    const nestedDirectoryPath = path.join(temporaryDirectoryPath, "traces", "events");

    try {
      expect(fs.existsSync(nestedDirectoryPath)).toBe(false);
      owner.ensureDirectoryExists(nestedDirectoryPath);
      expect(fs.existsSync(nestedDirectoryPath)).toBe(true);

      owner.ensureDirectoryExists(nestedDirectoryPath);
      expect(fs.existsSync(nestedDirectoryPath)).toBe(true);
    } finally {
      fs.rmSync(temporaryDirectoryPath, { recursive: true, force: true });
    }
  });

  it("rejects blank directory paths", () => {
    const owner = new ServerBootstrapUtilityOwner();

    expect(() => owner.ensureDirectoryExists("")).toThrow(
      "Directory path must contain at least one non-whitespace character.",
    );
    expect(() => owner.ensureDirectoryExists("   ")).toThrow(
      "Directory path must contain at least one non-whitespace character.",
    );
  });
});

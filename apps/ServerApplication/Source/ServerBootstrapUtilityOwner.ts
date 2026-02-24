import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { JsonValue } from "@farfield/protocol";
import type { AgentAdapter, AgentDescriptor } from "./Agents/Types.js";

export class ServerBootstrapUtilityOwner {
  public jsonResponse(res: ServerResponse, statusCode: number, body: object): void {
    const encoded = Buffer.from(JSON.stringify(body), "utf8");
    res.writeHead(statusCode, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": encoded.length,
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "content-type, x-farfield-token, x-farfield-request-id, x-farfield-action-id, x-farfield-action-name",
      "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS"
    });
    res.end(encoded);
  }

  public async readJsonBody(req: IncomingMessage): Promise<JsonValue> {
    const chunks: Buffer[] = [];

    for await (const chunk of req) {
      if (typeof chunk === "string") {
        chunks.push(Buffer.from(chunk, "utf8"));
        continue;
      }
      chunks.push(Buffer.from(chunk));
    }

    const raw = Buffer.concat(chunks).toString("utf8").trim();
    if (!raw) {
      return {};
    }

    return JSON.parse(raw);
  }

  public toErrorMessage<ErrorType>(error: ErrorType): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === "string") {
      return error;
    }
    return String(error);
  }

  public ensureDirectoryExists(path: string): void {
    if (!fs.existsSync(path)) {
      fs.mkdirSync(path, { recursive: true });
    }
  }

  public buildAgentDescriptor(adapter: AgentAdapter, projectDirectories: string[]): AgentDescriptor {
    return {
      id: adapter.id,
      label: adapter.label,
      enabled: adapter.isEnabled(),
      connected: adapter.isConnected(),
      capabilities: adapter.capabilities,
      projectDirectories
    };
  }
}

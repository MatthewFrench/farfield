import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { JsonObjectSchema, type JsonValue, JsonValueSchema } from "@farfield/protocol";
import { z } from "zod";
import type { AgentAdapter, AgentDescriptor } from "../../Agents/Types.js";

const JsonResponseHeaderValues = Object.freeze({
  accessControlAllowHeaders:
    "content-type, x-farfield-token, x-farfield-request-id, x-farfield-action-id, x-farfield-action-name",
  accessControlAllowMethods: "GET,POST,DELETE,OPTIONS",
  accessControlAllowOrigin: "*",
  contentType: "application/json; charset=utf-8",
});
const BootstrapUtilityMessageByName = Object.freeze({
  invalidJsonBody: "Request body must be valid JSON.",
  invalidJsonBodyShape: "Request body must be a JSON object.",
  directoryPathBlank: "Directory path must contain at least one non-whitespace character.",
});
const HttpStatusCodeSchema = z.number().int().min(100).max(599);
const JsonRequestBodySchema = JsonObjectSchema;
const NonBlankDirectoryPathSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0, {
    message: BootstrapUtilityMessageByName.directoryPathBlank,
  });
const ErrorInstanceSchema = z.instanceof(Error);
const ErrorMessageObjectSchema = z.object({
  message: z.string(),
});
const ErrorStringSchema = z.string();

// Boundary owner for bootstrap-time JSON ingress/egress and trace-directory initialization.
export class ServerBootstrapUtilityOwner {
  public jsonResponse(res: ServerResponse, statusCode: number, body: object): void {
    const parsedStatusCode = HttpStatusCodeSchema.parse(statusCode);
    const encoded = Buffer.from(JSON.stringify(body), "utf8");
    res.writeHead(parsedStatusCode, {
      "Content-Type": JsonResponseHeaderValues.contentType,
      "Content-Length": encoded.length,
      "Access-Control-Allow-Origin": JsonResponseHeaderValues.accessControlAllowOrigin,
      "Access-Control-Allow-Headers": JsonResponseHeaderValues.accessControlAllowHeaders,
      "Access-Control-Allow-Methods": JsonResponseHeaderValues.accessControlAllowMethods,
    });
    res.end(encoded);
  }

  public async readJsonBody(req: IncomingMessage): Promise<JsonValue> {
    const rawBody = (await this.readRequestBodyText(req)).trim();
    if (rawBody.length === 0) {
      return {};
    }

    let parsedJsonValue: JsonValue;
    try {
      parsedJsonValue = JsonValueSchema.parse(JSON.parse(rawBody));
    } catch {
      throw new Error(BootstrapUtilityMessageByName.invalidJsonBody);
    }

    const parsedRequestBody = JsonRequestBodySchema.safeParse(parsedJsonValue);
    if (!parsedRequestBody.success) {
      throw new Error(BootstrapUtilityMessageByName.invalidJsonBodyShape);
    }
    return parsedRequestBody.data;
  }

  public toErrorMessage<ErrorType>(error: ErrorType): string {
    const parsedErrorInstance = ErrorInstanceSchema.safeParse(error);
    if (parsedErrorInstance.success) {
      return parsedErrorInstance.data.message;
    }

    const parsedErrorMessageObject = ErrorMessageObjectSchema.safeParse(error);
    if (parsedErrorMessageObject.success) {
      return parsedErrorMessageObject.data.message;
    }

    const parsedErrorString = ErrorStringSchema.safeParse(error);
    if (parsedErrorString.success) {
      return parsedErrorString.data;
    }
    return String(error);
  }

  public ensureDirectoryExists(path: string): void {
    const parsedPath = NonBlankDirectoryPathSchema.parse(path);
    fs.mkdirSync(parsedPath, { recursive: true });
  }

  public buildAgentDescriptor(
    adapter: AgentAdapter,
    projectDirectories: string[],
  ): AgentDescriptor {
    return {
      id: adapter.id,
      label: adapter.label,
      enabled: adapter.isEnabled(),
      connected: adapter.isConnected(),
      capabilities: adapter.capabilities,
      projectDirectories,
    };
  }

  private async readRequestBodyText(req: IncomingMessage): Promise<string> {
    req.setEncoding("utf8");
    let body = "";
    for await (const chunk of req) {
      body += chunk;
    }
    return body;
  }
}

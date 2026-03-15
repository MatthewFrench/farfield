import { z } from "zod";
import type { OpenCodeClientOptions, OpenCodeServerStartOptions } from "./Client.js";

/**
 * Owns strict option parsing and startup default values for OpenCode connections.
 */
const OPEN_CODE_DEFAULT_HOSTNAME = "127.0.0.1";
const OPEN_CODE_DEFAULT_PORT = 0;
const OPEN_CODE_START_TIMEOUT_MILLISECONDS = 30_000;

const OpenCodeHostnameSchema = z.string().trim().min(1);
const OpenCodePortSchema = z.number().int().nonnegative().max(65_535);
const OpenCodeBaseUrlSchema = z.string().trim().min(1);
const OpenCodeClientOptionsSchema = z
  .object({
    hostname: OpenCodeHostnameSchema.optional(),
    port: OpenCodePortSchema.optional(),
    url: OpenCodeBaseUrlSchema.optional(),
  })
  .strict();

export type OpenCodeParsedClientOptions = z.infer<typeof OpenCodeClientOptionsSchema>;

export function parseOpenCodeClientOptions(
  options: OpenCodeClientOptions,
): OpenCodeParsedClientOptions {
  return OpenCodeClientOptionsSchema.parse(options);
}

export function parseOpenCodeBaseUrl(url: string): string {
  return OpenCodeBaseUrlSchema.parse(url);
}

export function buildOpenCodeServerStartOptions(
  options: OpenCodeParsedClientOptions,
): OpenCodeServerStartOptions {
  return {
    hostname: options.hostname ?? OPEN_CODE_DEFAULT_HOSTNAME,
    port: options.port ?? OPEN_CODE_DEFAULT_PORT,
    timeoutMilliseconds: OPEN_CODE_START_TIMEOUT_MILLISECONDS,
  };
}

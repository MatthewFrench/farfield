import pino, { type LoggerOptions } from "pino";
import { z } from "zod";

export const LoggerLevelSchema = z.enum([
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "silent"
]);
export type LoggerLevel = z.infer<typeof LoggerLevelSchema>;

export const SERVER_LOGGER_NAME = "farfield-server";
export const DEFAULT_SERVER_LOGGER_LEVEL: LoggerLevel = "info";

function buildLoggerOptions(): LoggerOptions {
  return {
    name: SERVER_LOGGER_NAME,
    level: DEFAULT_SERVER_LOGGER_LEVEL
  };
}

export const logger = pino(buildLoggerOptions());

export function configureLogger(level: LoggerLevel): void {
  logger.level = level;
}

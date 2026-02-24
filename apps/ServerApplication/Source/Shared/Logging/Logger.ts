import pino from "pino";
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

export const logger = pino({
  name: "farfield-server",
  level: "info"
});

export function configureLogger(level: LoggerLevel): void {
  logger.level = level;
}

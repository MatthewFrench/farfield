import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SERVER_LOGGER_LEVEL,
  LoggerLevelSchema,
  SERVER_LOGGER_NAME,
  configureLogger,
  logger
} from "../Source/Shared/Logging/Logger.js";

function resetLoggerLevelToDefault(): void {
  configureLogger(DEFAULT_SERVER_LOGGER_LEVEL);
}

describe("Logger", () => {
  beforeEach(() => {
    resetLoggerLevelToDefault();
  });

  afterEach(() => {
    resetLoggerLevelToDefault();
  });

  it("exposes expected static logger contracts", () => {
    expect(SERVER_LOGGER_NAME).toBe("farfield-server");
    expect(DEFAULT_SERVER_LOGGER_LEVEL).toBe("info");
  });

  it("starts with the configured default logger level", () => {
    expect(logger.level).toBe(DEFAULT_SERVER_LOGGER_LEVEL);
  });

  it("configures logger level with schema-validated values", () => {
    const nextLevel = LoggerLevelSchema.parse("debug");
    configureLogger(nextLevel);
    expect(logger.level).toBe("debug");
  });

  it("rejects unsupported logger levels through schema contract", () => {
    expect(() => LoggerLevelSchema.parse("verbose")).toThrow();
  });

  it("keeps logger identity name stable", () => {
    const bindings = logger.bindings();
    expect(bindings.name).toBe(SERVER_LOGGER_NAME);
  });
});

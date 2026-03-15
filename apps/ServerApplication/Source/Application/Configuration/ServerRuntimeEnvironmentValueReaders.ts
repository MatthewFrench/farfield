import path from "node:path";
import { z } from "zod";
import { ServerRuntimeParsingConstants } from "./ServerRuntimeConfigurationConstants.js";

// Owner note: this module is the single strict parser for environment values used
// by runtime configuration ingestion; all non-schema callers consume typed outputs.
const OptionalPathEnvironmentValueSchema = z.string().trim().min(1).optional();
const PositiveIntegerEnvironmentValueSchema = z.coerce
  .number()
  .int()
  .min(ServerRuntimeParsingConstants.minimumPositiveInteger);
const BooleanEnvironmentValueSchema = z.enum([
  ServerRuntimeParsingConstants.trueNumeric,
  ServerRuntimeParsingConstants.trueText,
  ServerRuntimeParsingConstants.falseNumeric,
  ServerRuntimeParsingConstants.falseText,
]);

function parsePositiveIntegerEnvironmentValue(value: string | null, defaultValue: number): number {
  const parsed = PositiveIntegerEnvironmentValueSchema.safeParse(value);
  return parsed.success ? parsed.data : defaultValue;
}

function parseBooleanEnvironmentValue(value: string | null, defaultValue: boolean): boolean {
  // Keep this strict and case-sensitive so only explicit opt-in tokens toggle behavior.
  const parsed = BooleanEnvironmentValueSchema.safeParse(value);
  if (!parsed.success) {
    return defaultValue;
  }

  return (
    parsed.data === ServerRuntimeParsingConstants.trueNumeric ||
    parsed.data === ServerRuntimeParsingConstants.trueText
  );
}

function parseOptionalPathEnvironmentValue(
  label: string,
  value: string | undefined,
): string | null {
  const parsed = OptionalPathEnvironmentValueSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`${label} must be a non-empty path when set`);
  }

  if (parsed.data === undefined) {
    return null;
  }

  return path.resolve(parsed.data);
}

export function readEnvironmentValue(env: NodeJS.ProcessEnv, variableName: string): string | null {
  return env[variableName] ?? null;
}

export function readTrimmedEnvironmentValue(env: NodeJS.ProcessEnv, variableName: string): string {
  return (readEnvironmentValue(env, variableName) ?? "").trim();
}

export function readPositiveIntegerEnvironmentValue(
  env: NodeJS.ProcessEnv,
  variableName: string,
  defaultValue: number,
): number {
  return parsePositiveIntegerEnvironmentValue(
    readEnvironmentValue(env, variableName),
    defaultValue,
  );
}

export function readBooleanEnvironmentValue(
  env: NodeJS.ProcessEnv,
  variableName: string,
  defaultValue: boolean,
): boolean {
  return parseBooleanEnvironmentValue(readEnvironmentValue(env, variableName), defaultValue);
}

export function readOptionalPathEnvironmentValue(
  env: NodeJS.ProcessEnv,
  variableName: string,
): string | null {
  return parseOptionalPathEnvironmentValue(variableName, env[variableName]);
}

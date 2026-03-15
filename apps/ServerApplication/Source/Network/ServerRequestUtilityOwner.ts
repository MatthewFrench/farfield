import { z } from "zod";
import type { AgentId } from "../Agents/Types.js";

const CodexAgentIdentifierLiteral = "codex";
const OpenCodeAgentIdentifierLiteral = "opencode";
const AgentIdentifierLiterals = [
  CodexAgentIdentifierLiteral,
  OpenCodeAgentIdentifierLiteral,
] as const;
const NumericTrueBooleanLiteral = "1";
const NumericFalseBooleanLiteral = "0";
const TextTrueBooleanLiteral = "true";
const TextFalseBooleanLiteral = "false";
const BooleanParameterLiterals = [
  NumericTrueBooleanLiteral,
  NumericFalseBooleanLiteral,
  TextTrueBooleanLiteral,
  TextFalseBooleanLiteral,
] as const;
const TimeoutErrorMessageConnector = " timed out after ";
const TimeoutErrorMessageUnitMilliseconds = "ms";

const AgentIdParameterSchema = z.enum(AgentIdentifierLiterals);
const PositiveIntegerParameterSchema = z.coerce.number().int().positive();
const BooleanParameterSchema = z
  .enum(BooleanParameterLiterals)
  .transform((value) => value === NumericTrueBooleanLiteral || value === TextTrueBooleanLiteral);
// Request and query string normalization policy: empty or whitespace-only inputs
// are treated as missing so downstream owners receive either a meaningful value or null.
const NonEmptyTrimmedStringSchema = z.string().trim().min(1);

export class ServerRequestUtilityOwner {
  public parseInteger(value: string | null, defaultValue: number): number {
    const parsedDefaultValue = PositiveIntegerParameterSchema.parse(defaultValue);
    if (value === null) {
      return parsedDefaultValue;
    }
    const parsedValue = PositiveIntegerParameterSchema.safeParse(value);
    return parsedValue.success ? parsedValue.data : parsedDefaultValue;
  }

  public parseBoolean(value: string | null, defaultValue: boolean): boolean {
    if (value === null) {
      return defaultValue;
    }
    const normalizedValue = value.trim().toLowerCase();
    const parsedValue = BooleanParameterSchema.safeParse(normalizedValue);
    return parsedValue.success ? parsedValue.data : defaultValue;
  }

  public parseAgentId(value: string | null): AgentId | null {
    if (value === null) {
      return null;
    }

    const parsed = AgentIdParameterSchema.safeParse(value.trim().toLowerCase());
    return parsed.success ? parsed.data : null;
  }

  public normalizeOptionalString(value: string | null): string | null {
    if (value === null) {
      return null;
    }
    const parsedValue = NonEmptyTrimmedStringSchema.safeParse(value);
    return parsedValue.success ? parsedValue.data : null;
  }

  public async withTimeout<ValueType>(
    promise: Promise<ValueType>,
    timeoutMs: number,
    label: string,
  ): Promise<ValueType> {
    // Timeout policy is strictly positive to avoid immediate/negative timers that
    // would make request time-limit behavior non-deterministic.
    const parsedTimeoutMs = PositiveIntegerParameterSchema.parse(timeoutMs);
    const parsedLabel = NonEmptyTrimmedStringSchema.parse(label);
    let rejectOnTimeout: (error: Error) => void = (_error) => {
      return;
    };
    const timeoutPromise = new Promise<ValueType>((_resolve, reject) => {
      rejectOnTimeout = reject;
    });
    const timeoutHandle = setTimeout(() => {
      rejectOnTimeout(
        new Error(
          `${parsedLabel}${TimeoutErrorMessageConnector}${String(parsedTimeoutMs)}${TimeoutErrorMessageUnitMilliseconds}`,
        ),
      );
    }, parsedTimeoutMs);

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}

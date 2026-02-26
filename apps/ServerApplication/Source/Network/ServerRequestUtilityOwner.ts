import { z } from "zod";
import type { AgentId } from "../Agents/Types.js";

const AgentIdParameterSchema = z.enum(["codex", "opencode"]);
const PositiveIntegerParameterSchema = z.coerce.number().int().positive();
const BooleanParameterSchema = z
  .enum(["1", "0", "true", "false"])
  .transform((value) => value === "1" || value === "true");
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
    label: string
  ): Promise<ValueType> {
    const parsedTimeoutMs = PositiveIntegerParameterSchema.parse(timeoutMs);
    const parsedLabel = NonEmptyTrimmedStringSchema.parse(label);
    let timeoutHandle: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<ValueType>((_resolve, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`${parsedLabel} timed out after ${String(parsedTimeoutMs)}ms`));
      }, parsedTimeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }
}

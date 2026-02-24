import { z } from "zod";
import type { AgentId } from "../Agents/Types.js";

const AgentIdParameterSchema = z.enum(["codex", "opencode"]);

export class ServerRequestUtilityOwner {
  public parseInteger(value: string | null, defaultValue: number): number {
    if (!value) {
      return defaultValue;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return defaultValue;
    }

    return parsed;
  }

  public parseBoolean(value: string | null, defaultValue: boolean): boolean {
    if (!value) {
      return defaultValue;
    }

    if (value === "1" || value === "true") {
      return true;
    }

    if (value === "0" || value === "false") {
      return false;
    }

    return defaultValue;
  }

  public parseAgentId(value: string | null): AgentId | null {
    if (!value) {
      return null;
    }

    const parsed = AgentIdParameterSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  }

  public normalizeOptionalString(value: string | null): string | null {
    if (!value) {
      return null;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  public async withTimeout<ValueType>(
    promise: Promise<ValueType>,
    timeoutMs: number,
    label: string
  ): Promise<ValueType> {
    let timeoutHandle: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<ValueType>((_resolve, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`${label} timed out after ${String(timeoutMs)}ms`));
      }, timeoutMs);
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

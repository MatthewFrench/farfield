import { JsonValueSchema } from "@farfield/protocol";
import { z } from "zod";
import type { ConfigWriteValueOptions } from "./AppServerClient.js";

const AppServerConfigWriteMergeStrategySchema = z.enum(["replace", "upsert"]);

const AppServerConfigValueWriteRequestSchema = z
  .object({
    keyPath: z.string().min(1),
    value: JsonValueSchema,
    mergeStrategy: AppServerConfigWriteMergeStrategySchema,
    filePath: z.string().min(1).nullable().optional(),
    expectedVersion: z.string().min(1).nullable().optional(),
  })
  .passthrough();

interface ConfigValueWriteRequestParameters {
  keyPath: string;
  value: z.infer<typeof JsonValueSchema>;
  mergeStrategy: z.infer<typeof AppServerConfigWriteMergeStrategySchema>;
  filePath?: string | null | undefined;
  expectedVersion?: string | null | undefined;
}

export function buildConfigValueWriteRequestParameters(
  options: ConfigWriteValueOptions,
): ConfigValueWriteRequestParameters {
  return AppServerConfigValueWriteRequestSchema.parse({
    keyPath: options.keyPath,
    value: options.value,
    mergeStrategy: options.mergeStrategy,
    ...(options.filePath !== undefined ? { filePath: options.filePath } : {}),
    ...(options.expectedVersion !== undefined ? { expectedVersion: options.expectedVersion } : {}),
  });
}

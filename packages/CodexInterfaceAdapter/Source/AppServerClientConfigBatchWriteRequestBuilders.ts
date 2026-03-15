import { JsonValueSchema } from "@farfield/protocol";
import { z } from "zod";
import type { ConfigBatchWriteOptions } from "./AppServerClient.js";

const AppServerConfigWriteMergeStrategySchema = z.enum(["replace", "upsert"]);

const AppServerConfigBatchWriteEditSchema = z
  .object({
    keyPath: z.string().min(1),
    value: JsonValueSchema,
    mergeStrategy: AppServerConfigWriteMergeStrategySchema,
  })
  .strict();

const AppServerConfigBatchWriteRequestSchema = z
  .object({
    edits: z.array(AppServerConfigBatchWriteEditSchema).min(1),
    filePath: z.string().min(1).nullable().optional(),
    expectedVersion: z.string().min(1).nullable().optional(),
  })
  .passthrough();

interface ConfigBatchWriteEditRequestParameters {
  keyPath: string;
  value: z.infer<typeof JsonValueSchema>;
  mergeStrategy: z.infer<typeof AppServerConfigWriteMergeStrategySchema>;
}

interface ConfigBatchWriteRequestParameters {
  edits: ConfigBatchWriteEditRequestParameters[];
  filePath?: string | null | undefined;
  expectedVersion?: string | null | undefined;
}

export function buildConfigBatchWriteRequestParameters(
  options: ConfigBatchWriteOptions,
): ConfigBatchWriteRequestParameters {
  return AppServerConfigBatchWriteRequestSchema.parse({
    edits: options.edits.map((edit) => ({
      keyPath: edit.keyPath,
      value: edit.value,
      mergeStrategy: edit.mergeStrategy,
    })),
    ...(options.filePath !== undefined ? { filePath: options.filePath } : {}),
    ...(options.expectedVersion !== undefined ? { expectedVersion: options.expectedVersion } : {}),
  });
}

import { type JsonValue, JsonValueSchema } from "@farfield/protocol";
import { type Dispatch, type SetStateAction } from "react";
import { z } from "zod";
import type {
  CapabilityConfigBatchWriteOptions,
  CapabilityConfigWriteMergeStrategy,
  CapabilityServerClient,
} from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import type {
  DebugAppServerCoverageConfigBatchWriteResult,
  DebugAppServerCoverageConfigValueWriteResult,
} from "../DomainModel/DebugAppServerCoverageContracts";
import {
  mapConfigBatchWriteResult,
  mapConfigValueWriteResult,
} from "./DebugAppServerCoverageDiagnosticsMappers";

const COVERAGE_MUTATION_OPERATION_NAME = "debug-coverage-action";
const COVERAGE_ACTION_ERROR_PREFIX = "Unable to run coverage action: ";
const COVERAGE_CONFIG_VALUE_ERROR_MESSAGE = "Config value must be valid JSON.";
const COVERAGE_CONFIG_BATCH_EDITS_ERROR_MESSAGE = "Config batch edits must be a valid JSON array.";

const CoverageConfigBatchEditSchema = z
  .object({
    keyPath: z.string().min(1),
    value: JsonValueSchema,
    mergeStrategy: z.enum(["replace", "upsert"]),
  })
  .strict();
const CoverageConfigBatchEditListSchema = z.array(CoverageConfigBatchEditSchema).min(1);

export interface RunConfigValueWriteActionInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  keyPath: string;
  value: string;
  mergeStrategy: CapabilityConfigWriteMergeStrategy;
  filePath?: string;
  expectedVersion?: string;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastConfigValueWriteResult: Dispatch<
    SetStateAction<DebugAppServerCoverageConfigValueWriteResult | null>
  >;
}

function toErrorMessage<ErrorType>(error: ErrorType): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}

export function runConfigValueWriteAction(input: RunConfigValueWriteActionInput): void {
  if (input.isRunningCoverageAction) {
    return;
  }

  const normalizedKeyPath = input.keyPath.trim();
  if (normalizedKeyPath.length === 0) {
    return;
  }

  const normalizedValue = input.value.trim();
  if (normalizedValue.length === 0) {
    input.setCoverageActionErrorMessage(
      `${COVERAGE_ACTION_ERROR_PREFIX}${COVERAGE_CONFIG_VALUE_ERROR_MESSAGE}`,
    );
    return;
  }

  let parsedValue: JsonValue;
  try {
    parsedValue = JsonValueSchema.parse(JSON.parse(normalizedValue));
  } catch {
    input.setCoverageActionErrorMessage(
      `${COVERAGE_ACTION_ERROR_PREFIX}${COVERAGE_CONFIG_VALUE_ERROR_MESSAGE}`,
    );
    return;
  }

  const normalizedFilePath = input.filePath?.trim();
  const normalizedExpectedVersion = input.expectedVersion?.trim();

  input.setIsRunningCoverageAction(true);
  input.setCoverageActionErrorMessage("");

  void (async () => {
    try {
      const response = await input.capabilityServerClient.writeConfigValue({
        actionName: COVERAGE_MUTATION_OPERATION_NAME,
        keyPath: normalizedKeyPath,
        value: parsedValue,
        mergeStrategy: input.mergeStrategy,
        ...(normalizedFilePath !== undefined && normalizedFilePath.length > 0
          ? { filePath: normalizedFilePath }
          : {}),
        ...(normalizedExpectedVersion !== undefined && normalizedExpectedVersion.length > 0
          ? { expectedVersion: normalizedExpectedVersion }
          : {}),
      });
      input.setLastConfigValueWriteResult(
        mapConfigValueWriteResult(response, normalizedKeyPath, input.mergeStrategy, parsedValue),
      );
    } catch (error) {
      input.setCoverageActionErrorMessage(
        `${COVERAGE_ACTION_ERROR_PREFIX}${toErrorMessage(error)}`,
      );
    } finally {
      input.setIsRunningCoverageAction(false);
    }
  })();
}

export interface RunConfigBatchWriteActionInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  edits: string;
  filePath?: string;
  expectedVersion?: string;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastConfigBatchWriteResult: Dispatch<
    SetStateAction<DebugAppServerCoverageConfigBatchWriteResult | null>
  >;
}

export function runConfigBatchWriteAction(input: RunConfigBatchWriteActionInput): void {
  if (input.isRunningCoverageAction) {
    return;
  }

  const normalizedEdits = input.edits.trim();
  if (normalizedEdits.length === 0) {
    input.setCoverageActionErrorMessage(
      `${COVERAGE_ACTION_ERROR_PREFIX}${COVERAGE_CONFIG_BATCH_EDITS_ERROR_MESSAGE}`,
    );
    return;
  }

  let parsedEdits: CapabilityConfigBatchWriteOptions["edits"];
  try {
    parsedEdits = CoverageConfigBatchEditListSchema.parse(JSON.parse(normalizedEdits));
  } catch {
    input.setCoverageActionErrorMessage(
      `${COVERAGE_ACTION_ERROR_PREFIX}${COVERAGE_CONFIG_BATCH_EDITS_ERROR_MESSAGE}`,
    );
    return;
  }

  const normalizedFilePath = input.filePath?.trim();
  const normalizedExpectedVersion = input.expectedVersion?.trim();

  input.setIsRunningCoverageAction(true);
  input.setCoverageActionErrorMessage("");

  void (async () => {
    try {
      const response = await input.capabilityServerClient.writeConfigBatch({
        actionName: COVERAGE_MUTATION_OPERATION_NAME,
        edits: parsedEdits,
        ...(normalizedFilePath !== undefined && normalizedFilePath.length > 0
          ? { filePath: normalizedFilePath }
          : {}),
        ...(normalizedExpectedVersion !== undefined && normalizedExpectedVersion.length > 0
          ? { expectedVersion: normalizedExpectedVersion }
          : {}),
      });
      input.setLastConfigBatchWriteResult(mapConfigBatchWriteResult(response, parsedEdits.length));
    } catch (error) {
      input.setCoverageActionErrorMessage(
        `${COVERAGE_ACTION_ERROR_PREFIX}${toErrorMessage(error)}`,
      );
    } finally {
      input.setIsRunningCoverageAction(false);
    }
  })();
}

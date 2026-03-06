import { z } from "zod";
import { JsonObjectSchema, NonEmptyStringSchema, NonNegativeIntSchema } from "./Common.js";

export const FarfieldClientPerformanceOperationOutcomeSchema = z.enum([
  "succeeded",
  "failed",
  "canceled",
]);

export type FarfieldClientPerformanceOperationOutcome = z.infer<
  typeof FarfieldClientPerformanceOperationOutcomeSchema
>;

export const FarfieldClientPerformanceInstantEventSchema = z
  .object({
    sequence: NonNegativeIntSchema,
    name: NonEmptyStringSchema,
    atEpochMilliseconds: NonNegativeIntSchema,
    atHighResolutionMilliseconds: z.number().nonnegative(),
    details: JsonObjectSchema,
  })
  .strict();

export type FarfieldClientPerformanceInstantEvent = z.infer<
  typeof FarfieldClientPerformanceInstantEventSchema
>;

export const FarfieldClientPerformanceInFlightOperationSchema = z
  .object({
    sequence: NonNegativeIntSchema,
    name: NonEmptyStringSchema,
    startedAtEpochMilliseconds: NonNegativeIntSchema,
    startedAtHighResolutionMilliseconds: z.number().nonnegative(),
    details: JsonObjectSchema,
  })
  .strict();

export type FarfieldClientPerformanceInFlightOperation = z.infer<
  typeof FarfieldClientPerformanceInFlightOperationSchema
>;

export const FarfieldClientPerformanceCompletedOperationSchema = z
  .object({
    sequence: NonNegativeIntSchema,
    name: NonEmptyStringSchema,
    startedAtEpochMilliseconds: NonNegativeIntSchema,
    completedAtEpochMilliseconds: NonNegativeIntSchema,
    startedAtHighResolutionMilliseconds: z.number().nonnegative(),
    completedAtHighResolutionMilliseconds: z.number().nonnegative(),
    durationMilliseconds: z.number().nonnegative(),
    outcome: FarfieldClientPerformanceOperationOutcomeSchema,
    details: JsonObjectSchema,
    completionDetails: JsonObjectSchema,
  })
  .strict();

export type FarfieldClientPerformanceCompletedOperation = z.infer<
  typeof FarfieldClientPerformanceCompletedOperationSchema
>;

export const FarfieldClientPerformanceLongTaskSchema = z
  .object({
    sequence: NonNegativeIntSchema,
    startedAtEpochMilliseconds: NonNegativeIntSchema,
    completedAtEpochMilliseconds: NonNegativeIntSchema,
    startedAtHighResolutionMilliseconds: z.number().nonnegative(),
    completedAtHighResolutionMilliseconds: z.number().nonnegative(),
    durationMilliseconds: z.number().nonnegative(),
  })
  .strict();

export type FarfieldClientPerformanceLongTask = z.infer<
  typeof FarfieldClientPerformanceLongTaskSchema
>;

export const FarfieldClientPerformanceFreezeWindowSchema = z
  .object({
    sequence: NonNegativeIntSchema,
    startedAtEpochMilliseconds: NonNegativeIntSchema,
    completedAtEpochMilliseconds: NonNegativeIntSchema,
    startedAtHighResolutionMilliseconds: z.number().nonnegative(),
    completedAtHighResolutionMilliseconds: z.number().nonnegative(),
    durationMilliseconds: z.number().nonnegative(),
  })
  .strict();

export type FarfieldClientPerformanceFreezeWindow = z.infer<
  typeof FarfieldClientPerformanceFreezeWindowSchema
>;

export const FarfieldClientPerformanceProbeSnapshotSchema = z
  .object({
    installedAtEpochMilliseconds: NonNegativeIntSchema,
    freezeThresholdMilliseconds: z.number().nonnegative(),
    instantEvents: z.array(FarfieldClientPerformanceInstantEventSchema),
    inFlightOperations: z.array(FarfieldClientPerformanceInFlightOperationSchema),
    completedOperations: z.array(FarfieldClientPerformanceCompletedOperationSchema),
    longTasks: z.array(FarfieldClientPerformanceLongTaskSchema),
    freezeWindows: z.array(FarfieldClientPerformanceFreezeWindowSchema),
  })
  .strict();

export type FarfieldClientPerformanceProbeSnapshot = z.infer<
  typeof FarfieldClientPerformanceProbeSnapshotSchema
>;

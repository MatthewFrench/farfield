import fs from "node:fs/promises";
import path from "node:path";
import {
  type FarfieldClientPerformanceCompletedOperation,
  type FarfieldClientPerformanceFreezeWindow,
  type FarfieldClientPerformanceProbeSnapshot,
  FarfieldClientPerformanceProbeSnapshotSchema,
} from "@farfield/protocol";
import type { Page, TestInfo } from "@playwright/test";
import { z } from "zod";
import { resolveRealEndToEndRuntimeOutputDirectory } from "./output-profile";

const PerformanceBudgetModeSchema = z.enum(["fail", "warn"]);

const PerformanceProbeSnapshotSchema = z
  .object({
    firstPaintMilliseconds: z.number().nonnegative().nullable(),
    firstContentfulPaintMilliseconds: z.number().nonnegative().nullable(),
    largestContentfulPaintMilliseconds: z.number().nonnegative().nullable(),
    domContentLoadedMilliseconds: z.number().nonnegative().nullable(),
    loadEventMilliseconds: z.number().nonnegative().nullable(),
    cumulativeLayoutShift: z.number().nonnegative(),
    longTaskCount: z.number().int().nonnegative(),
    longTaskTotalDurationMilliseconds: z.number().nonnegative(),
  })
  .strict();

const FreezeProfileOperationOverlapSchema = z
  .object({
    sequence: z.number().int().nonnegative(),
    name: z.string().min(1),
    durationMilliseconds: z.number().nonnegative(),
    outcome: z.enum(["succeeded", "failed", "canceled"]),
  })
  .strict();

const FreezeProfileIncidentSchema = z
  .object({
    freezeWindow: z
      .object({
        sequence: z.number().int().nonnegative(),
        startedAtEpochMilliseconds: z.number().int().nonnegative(),
        completedAtEpochMilliseconds: z.number().int().nonnegative(),
        startedAtHighResolutionMilliseconds: z.number().nonnegative(),
        completedAtHighResolutionMilliseconds: z.number().nonnegative(),
        durationMilliseconds: z.number().nonnegative(),
      })
      .strict(),
    overlappingOperations: z.array(FreezeProfileOperationOverlapSchema),
    overlappingLongTaskCount: z.number().int().nonnegative(),
    overlappingLongTaskTotalDurationMilliseconds: z.number().nonnegative(),
  })
  .strict();

const FreezeProfileOperationAggregateSchema = z
  .object({
    name: z.string().min(1),
    count: z.number().int().nonnegative(),
    totalDurationMilliseconds: z.number().nonnegative(),
    maxDurationMilliseconds: z.number().nonnegative(),
  })
  .strict();

const FreezeProfileReportSchema = z
  .object({
    freezeCount: z.number().int().nonnegative(),
    totalFreezeDurationMilliseconds: z.number().nonnegative(),
    maximumFreezeDurationMilliseconds: z.number().nonnegative(),
    maximumLongTaskDurationMilliseconds: z.number().nonnegative(),
    incidents: z.array(FreezeProfileIncidentSchema),
    overlappingOperationAggregates: z.array(FreezeProfileOperationAggregateSchema),
  })
  .strict();

const FreezeProfileArtifactSchema = z
  .object({
    label: z.string().min(1),
    recordedAt: z.string().datetime(),
    snapshot: FarfieldClientPerformanceProbeSnapshotSchema,
    report: FreezeProfileReportSchema,
    artifactPath: z.string().min(1),
  })
  .strict();

const DEFAULT_PERFORMANCE_BUDGET_MODE = "fail";
const PERFORMANCE_BUDGET_MODE = PerformanceBudgetModeSchema.parse(
  (process.env["E2E_REAL_PERFORMANCE_BUDGET_MODE"] ?? DEFAULT_PERFORMANCE_BUDGET_MODE)
    .trim()
    .toLowerCase(),
);

export interface PerformanceProbeSnapshot {
  firstPaintMilliseconds: number | null;
  firstContentfulPaintMilliseconds: number | null;
  largestContentfulPaintMilliseconds: number | null;
  domContentLoadedMilliseconds: number | null;
  loadEventMilliseconds: number | null;
  cumulativeLayoutShift: number;
  longTaskCount: number;
  longTaskTotalDurationMilliseconds: number;
}

export interface FreezeProfileOperationOverlap {
  sequence: number;
  name: string;
  durationMilliseconds: number;
  outcome: FarfieldClientPerformanceCompletedOperation["outcome"];
}

export interface FreezeProfileIncident {
  freezeWindow: FarfieldClientPerformanceFreezeWindow;
  overlappingOperations: FreezeProfileOperationOverlap[];
  overlappingLongTaskCount: number;
  overlappingLongTaskTotalDurationMilliseconds: number;
}

export interface FreezeProfileOperationAggregate {
  name: string;
  count: number;
  totalDurationMilliseconds: number;
  maxDurationMilliseconds: number;
}

export interface FreezeProfileReport {
  freezeCount: number;
  totalFreezeDurationMilliseconds: number;
  maximumFreezeDurationMilliseconds: number;
  maximumLongTaskDurationMilliseconds: number;
  incidents: FreezeProfileIncident[];
  overlappingOperationAggregates: FreezeProfileOperationAggregate[];
}

export interface RenderPerformanceBudgetInput {
  label: string;
  snapshot: PerformanceProbeSnapshot;
  maximumCumulativeLayoutShift: number;
  maximumLongTaskCount: number;
  maximumLongTaskTotalDurationMilliseconds: number;
  maximumFirstContentfulPaintMilliseconds: number;
}

export interface ReadinessBudgetInput {
  label: string;
  elapsedMilliseconds: number;
  maximumMilliseconds: number;
}

export interface FreezeProfileBudgetInput {
  label: string;
  report: FreezeProfileReport;
  maximumFreezeCount: number;
  maximumFreezeDurationMilliseconds: number;
  maximumTotalFreezeDurationMilliseconds: number;
  maximumLongTaskDurationMilliseconds: number;
}

function assertWithinMaximumBudget(input: {
  label: string;
  metric: string;
  observedValue: number;
  maximumValue: number;
}): void {
  if (input.observedValue <= input.maximumValue) {
    return;
  }

  const message = `[end-to-end-performance] ${input.label} ${input.metric} exceeded budget: observed=${String(
    input.observedValue,
  )} max=${String(input.maximumValue)}`;
  if (PERFORMANCE_BUDGET_MODE === "warn") {
    process.stdout.write(`${message}\n`);
    return;
  }

  throw new Error(message);
}

function formatMetricValue(value: number | null): string {
  if (value === null) {
    return "n/a";
  }
  return String(Math.round(value));
}

function sanitizeLabel(value: string): string {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

  return sanitized.length > 0 ? sanitized : "performance";
}

function rangesOverlap(input: {
  leftStartedAtHighResolutionMilliseconds: number;
  leftCompletedAtHighResolutionMilliseconds: number;
  rightStartedAtHighResolutionMilliseconds: number;
  rightCompletedAtHighResolutionMilliseconds: number;
}): boolean {
  return (
    input.leftStartedAtHighResolutionMilliseconds <
      input.rightCompletedAtHighResolutionMilliseconds &&
    input.rightStartedAtHighResolutionMilliseconds < input.leftCompletedAtHighResolutionMilliseconds
  );
}

export async function installPerformanceProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type PerformanceProbeState = {
      firstPaintMilliseconds: number | null;
      firstContentfulPaintMilliseconds: number | null;
      largestContentfulPaintMilliseconds: number | null;
      domContentLoadedMilliseconds: number | null;
      loadEventMilliseconds: number | null;
      cumulativeLayoutShift: number;
      longTaskCount: number;
      longTaskTotalDurationMilliseconds: number;
    };

    const typedWindow = window as Window & {
      __farfieldPerformanceProbeInstalled?: boolean;
      __farfieldPerformanceProbeState?: PerformanceProbeState;
    };

    if (typedWindow.__farfieldPerformanceProbeInstalled) {
      return;
    }

    typedWindow.__farfieldPerformanceProbeInstalled = true;
    typedWindow.__farfieldPerformanceProbeState = {
      firstPaintMilliseconds: null,
      firstContentfulPaintMilliseconds: null,
      largestContentfulPaintMilliseconds: null,
      domContentLoadedMilliseconds: null,
      loadEventMilliseconds: null,
      cumulativeLayoutShift: 0,
      longTaskCount: 0,
      longTaskTotalDurationMilliseconds: 0,
    };

    const readState = (): PerformanceProbeState => {
      const state = typedWindow.__farfieldPerformanceProbeState;
      if (state === undefined) {
        throw new Error("Performance probe state was not initialized.");
      }
      return state;
    };

    const updateNavigationTiming = (): void => {
      const navigationEntries = performance.getEntriesByType("navigation");
      const firstNavigationEntry = navigationEntries[0];
      if (!(firstNavigationEntry instanceof PerformanceNavigationTiming)) {
        return;
      }

      const state = readState();
      state.domContentLoadedMilliseconds = firstNavigationEntry.domContentLoadedEventEnd;
      state.loadEventMilliseconds = firstNavigationEntry.loadEventEnd;
      typedWindow.__farfieldPerformanceProbeState = state;
    };

    const updatePaintTiming = (): void => {
      const paintEntries = performance.getEntriesByType("paint");
      const state = readState();

      for (const entry of paintEntries) {
        if (entry.name === "first-paint") {
          state.firstPaintMilliseconds = entry.startTime;
          continue;
        }
        if (entry.name === "first-contentful-paint") {
          state.firstContentfulPaintMilliseconds = entry.startTime;
        }
      }

      typedWindow.__farfieldPerformanceProbeState = state;
    };

    const attachLayoutShiftObserver = (): void => {
      try {
        const observer = new PerformanceObserver((entryList) => {
          const state = readState();
          for (const entry of entryList.getEntries()) {
            const layoutShiftEntry = entry as PerformanceEntry & {
              value: number;
              hadRecentInput: boolean;
            };
            if (layoutShiftEntry.hadRecentInput) {
              continue;
            }
            state.cumulativeLayoutShift += layoutShiftEntry.value;
          }
          typedWindow.__farfieldPerformanceProbeState = state;
        });
        observer.observe({
          type: "layout-shift",
          buffered: true,
        });
      } catch {
        // Some browser builds do not support this observer entry type.
      }
    };

    const attachLongTaskObserver = (): void => {
      try {
        const observer = new PerformanceObserver((entryList) => {
          const state = readState();
          for (const entry of entryList.getEntries()) {
            state.longTaskCount += 1;
            state.longTaskTotalDurationMilliseconds += entry.duration;
          }
          typedWindow.__farfieldPerformanceProbeState = state;
        });
        observer.observe({
          type: "longtask",
          buffered: true,
        });
      } catch {
        // Some browser builds do not support this observer entry type.
      }
    };

    const attachLargestContentfulPaintObserver = (): void => {
      try {
        const observer = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const latestEntry = entries.at(-1);
          if (latestEntry === undefined) {
            return;
          }
          const state = readState();
          state.largestContentfulPaintMilliseconds = latestEntry.startTime;
          typedWindow.__farfieldPerformanceProbeState = state;
        });
        observer.observe({
          type: "largest-contentful-paint",
          buffered: true,
        });
      } catch {
        // Some browser builds do not support this observer entry type.
      }
    };

    updateNavigationTiming();
    updatePaintTiming();
    attachLayoutShiftObserver();
    attachLongTaskObserver();
    attachLargestContentfulPaintObserver();
  });
}

export async function readPerformanceProbeSnapshot(page: Page): Promise<PerformanceProbeSnapshot> {
  const rawSnapshot = await page.evaluate(() => {
    type PerformanceProbeState = {
      firstPaintMilliseconds: number | null;
      firstContentfulPaintMilliseconds: number | null;
      largestContentfulPaintMilliseconds: number | null;
      domContentLoadedMilliseconds: number | null;
      loadEventMilliseconds: number | null;
      cumulativeLayoutShift: number;
      longTaskCount: number;
      longTaskTotalDurationMilliseconds: number;
    };

    const typedWindow = window as Window & {
      __farfieldPerformanceProbeState?: PerformanceProbeState;
    };
    const state = typedWindow.__farfieldPerformanceProbeState;
    if (state === undefined) {
      return {
        firstPaintMilliseconds: null,
        firstContentfulPaintMilliseconds: null,
        largestContentfulPaintMilliseconds: null,
        domContentLoadedMilliseconds: null,
        loadEventMilliseconds: null,
        cumulativeLayoutShift: 0,
        longTaskCount: 0,
        longTaskTotalDurationMilliseconds: 0,
      };
    }

    return state;
  });

  return PerformanceProbeSnapshotSchema.parse(rawSnapshot);
}

export async function readClientPerformanceProbeSnapshot(
  page: Page,
): Promise<FarfieldClientPerformanceProbeSnapshot> {
  const rawSnapshot = await page.evaluate(() => {
    interface WindowWithClientPerformanceFreezeProbeOwner extends Window {
      __farfieldClientPerformanceFreezeProbeOwner?: {
        readSnapshot: () => FarfieldClientPerformanceProbeSnapshot;
      };
    }

    const typedWindow = window as WindowWithClientPerformanceFreezeProbeOwner;
    const owner = typedWindow.__farfieldClientPerformanceFreezeProbeOwner;
    if (owner === undefined) {
      return {
        installedAtEpochMilliseconds: 0,
        freezeThresholdMilliseconds: 0,
        instantEvents: [],
        inFlightOperations: [],
        completedOperations: [],
        longTasks: [],
        freezeWindows: [],
      };
    }

    return owner.readSnapshot();
  });

  return FarfieldClientPerformanceProbeSnapshotSchema.parse(rawSnapshot);
}

export async function resetClientPerformanceProbeSnapshot(page: Page): Promise<void> {
  await page.evaluate(() => {
    interface WindowWithClientPerformanceFreezeProbeOwner extends Window {
      __farfieldClientPerformanceFreezeProbeOwner?: {
        resetRecordedEntries: () => void;
      };
    }

    const typedWindow = window as WindowWithClientPerformanceFreezeProbeOwner;
    typedWindow.__farfieldClientPerformanceFreezeProbeOwner?.resetRecordedEntries();
  });
}

export async function measureElapsedMilliseconds(action: () => Promise<void>): Promise<number> {
  const startedAtMilliseconds = Date.now();
  await action();
  return Date.now() - startedAtMilliseconds;
}

export function assertReadinessBudget(input: ReadinessBudgetInput): void {
  assertWithinMaximumBudget({
    label: input.label,
    metric: "readinessMs",
    observedValue: input.elapsedMilliseconds,
    maximumValue: input.maximumMilliseconds,
  });
}

export function assertRenderPerformanceBudget(input: RenderPerformanceBudgetInput): void {
  assertWithinMaximumBudget({
    label: input.label,
    metric: "cumulativeLayoutShift",
    observedValue: input.snapshot.cumulativeLayoutShift,
    maximumValue: input.maximumCumulativeLayoutShift,
  });
  assertWithinMaximumBudget({
    label: input.label,
    metric: "longTaskCount",
    observedValue: input.snapshot.longTaskCount,
    maximumValue: input.maximumLongTaskCount,
  });
  assertWithinMaximumBudget({
    label: input.label,
    metric: "longTaskTotalDurationMs",
    observedValue: input.snapshot.longTaskTotalDurationMilliseconds,
    maximumValue: input.maximumLongTaskTotalDurationMilliseconds,
  });
  if (input.snapshot.firstContentfulPaintMilliseconds !== null) {
    assertWithinMaximumBudget({
      label: input.label,
      metric: "firstContentfulPaintMs",
      observedValue: input.snapshot.firstContentfulPaintMilliseconds,
      maximumValue: input.maximumFirstContentfulPaintMilliseconds,
    });
  }
}

export function buildFreezeProfileReport(
  snapshot: FarfieldClientPerformanceProbeSnapshot,
): FreezeProfileReport {
  const incidents = snapshot.freezeWindows
    .map<FreezeProfileIncident>((freezeWindow) => {
      const overlappingOperations = snapshot.completedOperations
        .filter((operation) =>
          rangesOverlap({
            leftStartedAtHighResolutionMilliseconds:
              freezeWindow.startedAtHighResolutionMilliseconds,
            leftCompletedAtHighResolutionMilliseconds:
              freezeWindow.completedAtHighResolutionMilliseconds,
            rightStartedAtHighResolutionMilliseconds: operation.startedAtHighResolutionMilliseconds,
            rightCompletedAtHighResolutionMilliseconds:
              operation.completedAtHighResolutionMilliseconds,
          }),
        )
        .map<FreezeProfileOperationOverlap>((operation) => ({
          sequence: operation.sequence,
          name: operation.name,
          durationMilliseconds: operation.durationMilliseconds,
          outcome: operation.outcome,
        }))
        .sort((left, right) => right.durationMilliseconds - left.durationMilliseconds);

      const overlappingLongTasks = snapshot.longTasks.filter((longTask) =>
        rangesOverlap({
          leftStartedAtHighResolutionMilliseconds: freezeWindow.startedAtHighResolutionMilliseconds,
          leftCompletedAtHighResolutionMilliseconds:
            freezeWindow.completedAtHighResolutionMilliseconds,
          rightStartedAtHighResolutionMilliseconds: longTask.startedAtHighResolutionMilliseconds,
          rightCompletedAtHighResolutionMilliseconds:
            longTask.completedAtHighResolutionMilliseconds,
        }),
      );

      return {
        freezeWindow,
        overlappingOperations,
        overlappingLongTaskCount: overlappingLongTasks.length,
        overlappingLongTaskTotalDurationMilliseconds: overlappingLongTasks.reduce(
          (totalDurationMilliseconds, longTask) =>
            totalDurationMilliseconds + longTask.durationMilliseconds,
          0,
        ),
      };
    })
    .sort(
      (left, right) =>
        right.freezeWindow.durationMilliseconds - left.freezeWindow.durationMilliseconds,
    );

  const overlappingOperationAggregateMap = new Map<string, FreezeProfileOperationAggregate>();
  for (const incident of incidents) {
    for (const operation of incident.overlappingOperations) {
      const existingAggregate = overlappingOperationAggregateMap.get(operation.name);
      if (existingAggregate === undefined) {
        overlappingOperationAggregateMap.set(operation.name, {
          name: operation.name,
          count: 1,
          totalDurationMilliseconds: operation.durationMilliseconds,
          maxDurationMilliseconds: operation.durationMilliseconds,
        });
        continue;
      }

      overlappingOperationAggregateMap.set(operation.name, {
        name: existingAggregate.name,
        count: existingAggregate.count + 1,
        totalDurationMilliseconds:
          existingAggregate.totalDurationMilliseconds + operation.durationMilliseconds,
        maxDurationMilliseconds: Math.max(
          existingAggregate.maxDurationMilliseconds,
          operation.durationMilliseconds,
        ),
      });
    }
  }

  return FreezeProfileReportSchema.parse({
    freezeCount: snapshot.freezeWindows.length,
    totalFreezeDurationMilliseconds: snapshot.freezeWindows.reduce(
      (totalDurationMilliseconds, freezeWindow) =>
        totalDurationMilliseconds + freezeWindow.durationMilliseconds,
      0,
    ),
    maximumFreezeDurationMilliseconds: snapshot.freezeWindows.reduce(
      (maximumDurationMilliseconds, freezeWindow) =>
        Math.max(maximumDurationMilliseconds, freezeWindow.durationMilliseconds),
      0,
    ),
    maximumLongTaskDurationMilliseconds: snapshot.longTasks.reduce(
      (maximumDurationMilliseconds, longTask) =>
        Math.max(maximumDurationMilliseconds, longTask.durationMilliseconds),
      0,
    ),
    incidents,
    overlappingOperationAggregates: [...overlappingOperationAggregateMap.values()].sort(
      (left, right) => right.totalDurationMilliseconds - left.totalDurationMilliseconds,
    ),
  });
}

export function assertFreezeProfileBudget(input: FreezeProfileBudgetInput): void {
  assertWithinMaximumBudget({
    label: input.label,
    metric: "freezeCount",
    observedValue: input.report.freezeCount,
    maximumValue: input.maximumFreezeCount,
  });
  assertWithinMaximumBudget({
    label: input.label,
    metric: "maximumFreezeDurationMs",
    observedValue: input.report.maximumFreezeDurationMilliseconds,
    maximumValue: input.maximumFreezeDurationMilliseconds,
  });
  assertWithinMaximumBudget({
    label: input.label,
    metric: "totalFreezeDurationMs",
    observedValue: input.report.totalFreezeDurationMilliseconds,
    maximumValue: input.maximumTotalFreezeDurationMilliseconds,
  });
  assertWithinMaximumBudget({
    label: input.label,
    metric: "maximumLongTaskDurationMs",
    observedValue: input.report.maximumLongTaskDurationMilliseconds,
    maximumValue: input.maximumLongTaskDurationMilliseconds,
  });
}

export async function writeFreezeProfileArtifact(input: {
  testInfo: TestInfo;
  label: string;
  snapshot: FarfieldClientPerformanceProbeSnapshot;
  report: FreezeProfileReport;
}): Promise<string> {
  const outputDirectory = resolveRealEndToEndRuntimeOutputDirectory("end-to-end-performance");
  await fs.mkdir(outputDirectory, { recursive: true });

  const artifactFileName = `${sanitizeLabel(input.label)}.json`;
  const artifactPath = path.join(outputDirectory, artifactFileName);
  const artifact = FreezeProfileArtifactSchema.parse({
    label: input.label,
    recordedAt: new Date().toISOString(),
    snapshot: input.snapshot,
    report: input.report,
    artifactPath,
  });
  const encoded = `${JSON.stringify(artifact, null, 2)}\n`;

  await fs.writeFile(artifactPath, encoded, "utf8");
  await fs.writeFile(path.join(outputDirectory, "latest.json"), encoded, "utf8");
  await input.testInfo.attach(`${sanitizeLabel(input.label)}-freeze-profile`, {
    body: Buffer.from(encoded, "utf8"),
    contentType: "application/json",
  });

  process.stdout.write(`[end-to-end-performance] freeze artifact ${artifactPath}\n`);
  return artifactPath;
}

export function logPerformanceProbeSnapshot(
  label: string,
  snapshot: PerformanceProbeSnapshot,
): void {
  process.stdout.write(
    `[end-to-end-performance] ${label}: fp=${formatMetricValue(
      snapshot.firstPaintMilliseconds,
    )} fcp=${formatMetricValue(snapshot.firstContentfulPaintMilliseconds)} lcp=${formatMetricValue(
      snapshot.largestContentfulPaintMilliseconds,
    )} dcl=${formatMetricValue(snapshot.domContentLoadedMilliseconds)} load=${formatMetricValue(
      snapshot.loadEventMilliseconds,
    )} cls=${snapshot.cumulativeLayoutShift.toFixed(4)} longTasks=${String(
      snapshot.longTaskCount,
    )} longTaskDurationMs=${Math.round(snapshot.longTaskTotalDurationMilliseconds)}\n`,
  );
}

export function logFreezeProfileReport(label: string, report: FreezeProfileReport): void {
  const longestIncident = report.incidents[0] ?? null;
  const topOperation = report.overlappingOperationAggregates[0] ?? null;
  process.stdout.write(
    `[end-to-end-performance] ${label} freeze: count=${String(
      report.freezeCount,
    )} totalFreezeMs=${Math.round(report.totalFreezeDurationMilliseconds)} maxFreezeMs=${Math.round(
      report.maximumFreezeDurationMilliseconds,
    )} maxLongTaskMs=${Math.round(report.maximumLongTaskDurationMilliseconds)} topOperation=${
      topOperation
        ? `${topOperation.name}:${Math.round(topOperation.totalDurationMilliseconds)}`
        : "n/a"
    } topFreezeOperationCount=${String(longestIncident?.overlappingOperations.length ?? 0)}\n`,
  );
}

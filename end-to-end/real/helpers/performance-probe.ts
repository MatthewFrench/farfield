import type { Page } from "@playwright/test";
import { z } from "zod";

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

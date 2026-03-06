import {
  FarfieldClientPerformanceCompletedOperationSchema,
  FarfieldClientPerformanceFreezeWindowSchema,
  type FarfieldClientPerformanceInFlightOperation,
  FarfieldClientPerformanceInFlightOperationSchema,
  FarfieldClientPerformanceInstantEventSchema,
  FarfieldClientPerformanceLongTaskSchema,
  type FarfieldClientPerformanceOperationOutcome,
  type FarfieldClientPerformanceProbeSnapshot,
  FarfieldClientPerformanceProbeSnapshotSchema,
  type JsonObject,
} from "@farfield/protocol";
import { z } from "zod";
import {
  type StructuredDataObject,
  StructuredDataObjectSchema,
} from "@/Shared/Contracts/StructuredDataValue";

const OperationNameSchema = z.string().trim().min(1);
const FreezeThresholdMillisecondsSchema = z.number().positive();
const MaximumBufferedEntryCountSchema = z.number().int().positive();
const DEFAULT_FREEZE_THRESHOLD_MILLISECONDS = 120;
const DEFAULT_MAXIMUM_BUFFERED_ENTRY_COUNT = 400;
const DOCUMENT_VISIBILITY_STATE_VISIBLE = "visible";

export interface ClientPerformanceOperationToken {
  sequence: number;
}

export interface ClientPerformanceFreezeProbeOwnerDependencies {
  readTimeOriginMilliseconds: () => number;
  readHighResolutionMilliseconds: () => number;
  readVisibilityState: () => DocumentVisibilityState | null;
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame: (handle: number) => void;
  freezeThresholdMilliseconds?: number;
  maximumBufferedEntryCount?: number;
}

interface InFlightOperationRecord {
  sequence: number;
  name: string;
  startedAtEpochMilliseconds: number;
  startedAtHighResolutionMilliseconds: number;
  details: JsonObject;
}

/**
 * Owns bounded browser-side freeze diagnostics for interactive debugging.
 * The owner records main-thread freeze windows, long tasks, and app-owned operation intervals
 * so mobile stalls can be correlated with concrete runtime work.
 */
export class ClientPerformanceFreezeProbeOwner {
  private readonly readTimeOriginMilliseconds: () => number;
  private readonly readHighResolutionMilliseconds: () => number;
  private readonly readVisibilityState: () => DocumentVisibilityState | null;
  private readonly requestAnimationFrame: (callback: FrameRequestCallback) => number;
  private readonly cancelAnimationFrame: (handle: number) => void;
  private readonly freezeThresholdMilliseconds: number;
  private readonly maximumBufferedEntryCount: number;
  private readonly installedAtEpochMilliseconds: number;
  private readonly instantEvents: z.infer<typeof FarfieldClientPerformanceInstantEventSchema>[];
  private readonly completedOperations: z.infer<
    typeof FarfieldClientPerformanceCompletedOperationSchema
  >[];
  private readonly longTasks: z.infer<typeof FarfieldClientPerformanceLongTaskSchema>[];
  private readonly freezeWindows: z.infer<typeof FarfieldClientPerformanceFreezeWindowSchema>[];
  private readonly inFlightOperationBySequence: Map<number, InFlightOperationRecord>;
  private nextSequence: number;
  private previousAnimationFrameHighResolutionMilliseconds: number | null;
  private animationFrameHandle: number | null;

  public constructor(dependencies: ClientPerformanceFreezeProbeOwnerDependencies) {
    this.readTimeOriginMilliseconds = dependencies.readTimeOriginMilliseconds;
    this.readHighResolutionMilliseconds = dependencies.readHighResolutionMilliseconds;
    this.readVisibilityState = dependencies.readVisibilityState;
    this.requestAnimationFrame = dependencies.requestAnimationFrame;
    this.cancelAnimationFrame = dependencies.cancelAnimationFrame;
    this.freezeThresholdMilliseconds = FreezeThresholdMillisecondsSchema.parse(
      dependencies.freezeThresholdMilliseconds ?? DEFAULT_FREEZE_THRESHOLD_MILLISECONDS,
    );
    this.maximumBufferedEntryCount = MaximumBufferedEntryCountSchema.parse(
      dependencies.maximumBufferedEntryCount ?? DEFAULT_MAXIMUM_BUFFERED_ENTRY_COUNT,
    );
    this.installedAtEpochMilliseconds = this.readCurrentEpochMilliseconds();
    this.instantEvents = [];
    this.completedOperations = [];
    this.longTasks = [];
    this.freezeWindows = [];
    this.inFlightOperationBySequence = new Map<number, InFlightOperationRecord>();
    this.nextSequence = 1;
    this.previousAnimationFrameHighResolutionMilliseconds = null;
    this.animationFrameHandle = null;
  }

  public start(): void {
    if (this.animationFrameHandle !== null) {
      return;
    }
    this.animationFrameHandle = this.requestAnimationFrame((now) => {
      this.handleAnimationFrame(now);
    });
  }

  public stop(): void {
    const currentAnimationFrameHandle = this.animationFrameHandle;
    if (currentAnimationFrameHandle !== null) {
      this.cancelAnimationFrame(currentAnimationFrameHandle);
    }
    this.animationFrameHandle = null;
    this.previousAnimationFrameHighResolutionMilliseconds = null;
  }

  public resetRecordedEntries(): void {
    this.instantEvents.length = 0;
    this.completedOperations.length = 0;
    this.longTasks.length = 0;
    this.freezeWindows.length = 0;
    this.inFlightOperationBySequence.clear();
    this.nextSequence = 1;
    this.previousAnimationFrameHighResolutionMilliseconds = null;
  }

  public recordLongTask(input: {
    startedAtHighResolutionMilliseconds: number;
    durationMilliseconds: number;
  }): void {
    const startedAtHighResolutionMilliseconds = z
      .number()
      .nonnegative()
      .parse(input.startedAtHighResolutionMilliseconds);
    const durationMilliseconds = z.number().nonnegative().parse(input.durationMilliseconds);
    const completedAtHighResolutionMilliseconds =
      startedAtHighResolutionMilliseconds + durationMilliseconds;

    this.appendBounded(
      this.longTasks,
      FarfieldClientPerformanceLongTaskSchema.parse({
        sequence: this.readNextSequence(),
        startedAtEpochMilliseconds: this.buildEpochMilliseconds(
          startedAtHighResolutionMilliseconds,
        ),
        completedAtEpochMilliseconds: this.buildEpochMilliseconds(
          completedAtHighResolutionMilliseconds,
        ),
        startedAtHighResolutionMilliseconds,
        completedAtHighResolutionMilliseconds,
        durationMilliseconds,
      }),
    );
  }

  public recordInstantEvent(name: string, details?: StructuredDataObject): void {
    const parsedName = OperationNameSchema.parse(name);
    const parsedDetails = StructuredDataObjectSchema.parse(details ?? {});
    const atHighResolutionMilliseconds = this.readHighResolutionMilliseconds();

    this.appendBounded(
      this.instantEvents,
      FarfieldClientPerformanceInstantEventSchema.parse({
        sequence: this.readNextSequence(),
        name: parsedName,
        atEpochMilliseconds: this.buildEpochMilliseconds(atHighResolutionMilliseconds),
        atHighResolutionMilliseconds,
        details: parsedDetails,
      }),
    );
  }

  public beginOperation(
    name: string,
    details?: StructuredDataObject,
  ): ClientPerformanceOperationToken {
    const parsedName = OperationNameSchema.parse(name);
    const parsedDetails = StructuredDataObjectSchema.parse(details ?? {});
    const startedAtHighResolutionMilliseconds = this.readHighResolutionMilliseconds();
    const sequence = this.readNextSequence();
    const inFlightOperation = FarfieldClientPerformanceInFlightOperationSchema.parse({
      sequence,
      name: parsedName,
      startedAtEpochMilliseconds: this.buildEpochMilliseconds(startedAtHighResolutionMilliseconds),
      startedAtHighResolutionMilliseconds,
      details: parsedDetails,
    });

    this.inFlightOperationBySequence.set(sequence, inFlightOperation);
    return {
      sequence,
    };
  }

  public completeOperation(
    token: ClientPerformanceOperationToken,
    outcome: FarfieldClientPerformanceOperationOutcome,
    completionDetails?: StructuredDataObject,
  ): void {
    const inFlightOperation = this.inFlightOperationBySequence.get(token.sequence);
    if (inFlightOperation === undefined) {
      return;
    }

    this.inFlightOperationBySequence.delete(token.sequence);
    const parsedCompletionDetails = StructuredDataObjectSchema.parse(completionDetails ?? {});
    const completedAtHighResolutionMilliseconds = this.readHighResolutionMilliseconds();

    this.appendBounded(
      this.completedOperations,
      FarfieldClientPerformanceCompletedOperationSchema.parse({
        sequence: inFlightOperation.sequence,
        name: inFlightOperation.name,
        startedAtEpochMilliseconds: inFlightOperation.startedAtEpochMilliseconds,
        completedAtEpochMilliseconds: this.buildEpochMilliseconds(
          completedAtHighResolutionMilliseconds,
        ),
        startedAtHighResolutionMilliseconds: inFlightOperation.startedAtHighResolutionMilliseconds,
        completedAtHighResolutionMilliseconds,
        durationMilliseconds:
          completedAtHighResolutionMilliseconds -
          inFlightOperation.startedAtHighResolutionMilliseconds,
        outcome,
        details: inFlightOperation.details,
        completionDetails: parsedCompletionDetails,
      }),
    );
  }

  public readSnapshot(): FarfieldClientPerformanceProbeSnapshot {
    return FarfieldClientPerformanceProbeSnapshotSchema.parse({
      installedAtEpochMilliseconds: this.installedAtEpochMilliseconds,
      freezeThresholdMilliseconds: this.freezeThresholdMilliseconds,
      instantEvents: [...this.instantEvents],
      inFlightOperations: [...this.inFlightOperationBySequence.values()],
      completedOperations: [...this.completedOperations],
      longTasks: [...this.longTasks],
      freezeWindows: [...this.freezeWindows],
    });
  }

  private handleAnimationFrame(now: number): void {
    if (this.readVisibilityState() !== DOCUMENT_VISIBILITY_STATE_VISIBLE) {
      this.previousAnimationFrameHighResolutionMilliseconds = now;
      this.scheduleNextAnimationFrame();
      return;
    }

    const previousAnimationFrameHighResolutionMilliseconds =
      this.previousAnimationFrameHighResolutionMilliseconds;
    if (previousAnimationFrameHighResolutionMilliseconds !== null) {
      const durationMilliseconds = now - previousAnimationFrameHighResolutionMilliseconds;
      if (durationMilliseconds >= this.freezeThresholdMilliseconds) {
        this.appendBounded(
          this.freezeWindows,
          FarfieldClientPerformanceFreezeWindowSchema.parse({
            sequence: this.readNextSequence(),
            startedAtEpochMilliseconds: this.buildEpochMilliseconds(
              previousAnimationFrameHighResolutionMilliseconds,
            ),
            completedAtEpochMilliseconds: this.buildEpochMilliseconds(now),
            startedAtHighResolutionMilliseconds: previousAnimationFrameHighResolutionMilliseconds,
            completedAtHighResolutionMilliseconds: now,
            durationMilliseconds,
          }),
        );
      }
    }

    this.previousAnimationFrameHighResolutionMilliseconds = now;
    this.scheduleNextAnimationFrame();
  }

  private scheduleNextAnimationFrame(): void {
    this.animationFrameHandle = this.requestAnimationFrame((now) => {
      this.handleAnimationFrame(now);
    });
  }

  private appendBounded<ValueType>(collection: ValueType[], value: ValueType): void {
    collection.push(value);
    if (collection.length <= this.maximumBufferedEntryCount) {
      return;
    }
    collection.splice(0, collection.length - this.maximumBufferedEntryCount);
  }

  private buildEpochMilliseconds(highResolutionMilliseconds: number): number {
    return Math.max(0, Math.round(this.readTimeOriginMilliseconds() + highResolutionMilliseconds));
  }

  private readCurrentEpochMilliseconds(): number {
    return this.buildEpochMilliseconds(this.readHighResolutionMilliseconds());
  }

  private readNextSequence(): number {
    const sequence = this.nextSequence;
    this.nextSequence += 1;
    return sequence;
  }
}

interface WindowWithClientPerformanceFreezeProbeOwner extends Window {
  __farfieldClientPerformanceFreezeProbeOwner?: ClientPerformanceFreezeProbeOwner;
}

function readGlobalOwner(): ClientPerformanceFreezeProbeOwner | null {
  if (typeof window === "undefined") {
    return null;
  }
  const typedWindow = window as WindowWithClientPerformanceFreezeProbeOwner;
  return typedWindow.__farfieldClientPerformanceFreezeProbeOwner ?? null;
}

export function beginGlobalPerformanceOperation(
  name: string,
  details?: StructuredDataObject,
): ClientPerformanceOperationToken | null {
  const owner = readGlobalOwner();
  if (owner === null) {
    return null;
  }
  return owner.beginOperation(name, details);
}

export function completeGlobalPerformanceOperation(
  token: ClientPerformanceOperationToken | null,
  outcome: FarfieldClientPerformanceOperationOutcome,
  completionDetails?: StructuredDataObject,
): void {
  if (token === null) {
    return;
  }
  const owner = readGlobalOwner();
  if (owner === null) {
    return;
  }
  owner.completeOperation(token, outcome, completionDetails);
}

export function recordGlobalPerformanceInstantEvent(
  name: string,
  details?: StructuredDataObject,
): void {
  const owner = readGlobalOwner();
  if (owner === null) {
    return;
  }
  owner.recordInstantEvent(name, details);
}

export interface PercentileSampleWindow {
  values: readonly number[];
  percentile: number;
}

/**
 * Owns bounded sample-window mutation for request timing telemetry so percentile work remains
 * proportional to configured sample limits and does not grow with lifetime process traffic.
 */
export function appendSampleWindowValue(
  sampleWindowValues: number[],
  value: number,
  maximumSampleCount: number,
): void {
  sampleWindowValues.push(value);
  if (sampleWindowValues.length > maximumSampleCount) {
    sampleWindowValues.shift();
  }
}

export function readNearestRankPercentile(sampleWindow: PercentileSampleWindow): number {
  if (sampleWindow.values.length === 0) {
    return 0;
  }

  // Nearest-rank percentile keeps reported values pinned to observed samples.
  const sortedValues = [...sampleWindow.values].sort((left, right) => left - right);
  const percentileIndex = Math.max(
    0,
    Math.min(
      sortedValues.length - 1,
      Math.ceil((sampleWindow.percentile / 100) * sortedValues.length) - 1,
    ),
  );
  return sortedValues[percentileIndex] ?? 0;
}

export function readSampleWindowMaximum(sampleWindowValues: readonly number[]): number {
  if (sampleWindowValues.length === 0) {
    return 0;
  }
  return Math.max(...sampleWindowValues);
}

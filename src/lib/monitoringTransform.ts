import type { KraCallTimeseriesPoint } from "@/api/types";

export interface ChartRow {
  time: string;
  [resultCd: string]: string | number;
}

/**
 * Flattens the raw `counts_by_result_cd` timeseries into per-row keyed values Recharts can
 * stack directly, and returns the full set of result codes seen across the range (so the
 * chart can render one <Area>/<Bar> per code without guessing which codes exist ahead of time).
 */
export function transformTimeseriesForChart(points: KraCallTimeseriesPoint[]): {
  rows: ChartRow[];
  resultCodes: string[];
} {
  const resultCodes = new Set<string>();
  const rows: ChartRow[] = points.map((point) => {
    const row: ChartRow = { time: point.bucket_start };
    for (const [code, count] of Object.entries(point.counts_by_result_cd)) {
      row[code] = count;
      resultCodes.add(code);
    }
    return row;
  });
  return { rows, resultCodes: Array.from(resultCodes).sort() };
}

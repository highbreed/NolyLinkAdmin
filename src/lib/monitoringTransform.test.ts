import { describe, expect, it } from "vitest";
import { transformTimeseriesForChart } from "@/lib/monitoringTransform";

describe("transformTimeseriesForChart", () => {
  it("flattens counts_by_result_cd into per-row keys and collects the full code set", () => {
    const { rows, resultCodes } = transformTimeseriesForChart([
      { bucket_start: "2026-08-31T00:00:00Z", counts_by_result_cd: { "000": 10, "999": 1 } },
      { bucket_start: "2026-08-31T00:05:00Z", counts_by_result_cd: { "000": 12, "990": 2 } },
    ]);

    expect(resultCodes).toEqual(["000", "990", "999"]);
    expect(rows).toEqual([
      { time: "2026-08-31T00:00:00Z", "000": 10, "999": 1 },
      { time: "2026-08-31T00:05:00Z", "000": 12, "990": 2 },
    ]);
  });

  it("returns empty rows/codes for an empty timeseries", () => {
    expect(transformTimeseriesForChart([])).toEqual({ rows: [], resultCodes: [] });
  });
});

import { describe, expect, it } from "vitest";
import { classifyInventory, computeSaleTotals, weightedForecast } from "./business-logic";

describe("business logic", () => {
  it("computes revenue, cost, profit, and margin from a sale", () => {
    expect(computeSaleTotals(3, 80, 35)).toEqual({ revenue: 240, cost: 105, profit: 135, margin: 56.25 });
  });

  it("classifies stock against a minimum threshold", () => {
    expect(classifyInventory(0, 10)).toBe("out");
    expect(classifyInventory(5, 10)).toBe("low");
    expect(classifyInventory(12, 10)).toBe("warning");
    expect(classifyInventory(20, 10)).toBe("healthy");
  });

  it("forecasts from the most recent non-zero days and preserves the horizon", () => {
    expect(weightedForecast([0, 100, 120, 80], 3)).toEqual([100, 101.2, 102.4]);
    expect(weightedForecast([], 2)).toEqual([0, 0]);
  });
});

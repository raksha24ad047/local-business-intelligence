import { describe, expect, it } from "vitest";
import { aggregateCustomerMetrics, calculateGrowth, classifyInventory, computeSaleTotals, makeSaleSourceHash, weightedForecast } from "./business-logic";

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

  it("calculates percentage growth without inventing a baseline", () => {
    expect(calculateGrowth(120, 100)).toBe(20);
    expect(calculateGrowth(0, 0)).toBe(0);
    expect(calculateGrowth(100, 0)).toBeNull();
  });

  it("creates stable source fingerprints for duplicate imports", () => {
    const input = { date: new Date("2026-01-01T00:00:00.000Z"), productName: " Latte ", quantity: 2, unitPrice: 100, unitCost: 40, customerExternalId: " C-1 " };
    expect(makeSaleSourceHash(input)).toBe(makeSaleSourceHash({ ...input, productName: "latte", customerExternalId: "c-1" }));
    expect(makeSaleSourceHash(input)).not.toBe(makeSaleSourceHash({ ...input, quantity: 3 }));
  });

  it("derives customer repeat and spending metrics from actual sales", () => {
    const result = aggregateCustomerMetrics(
      [{ id: 1, externalId: "C-1" }, { id: 2, externalId: "C-2" }],
      [
        { customerId: 1, quantity: 2, revenue: "200.00", profit: "80.00", saleDate: "2026-01-01T00:00:00.000Z" },
        { customerId: 1, quantity: 1, revenue: "100.00", profit: "40.00", saleDate: "2026-01-02T00:00:00.000Z" },
        { customerId: 2, quantity: 1, revenue: "50.00", profit: "20.00", saleDate: "2026-01-03T00:00:00.000Z" },
      ],
    );
    expect(result[0]).toMatchObject({ orderCount: 2, quantity: 3, revenue: 300, profit: 120, isReturning: true });
    expect(result[1]).toMatchObject({ orderCount: 1, quantity: 1, revenue: 50, profit: 20, isReturning: false });
  });
});

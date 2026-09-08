export function computeSaleTotals(quantity: number, unitPrice: number, unitCost: number) {
  const revenue = quantity * unitPrice;
  const cost = quantity * unitCost;
  return {
    revenue: Math.round(revenue * 100) / 100,
    cost: Math.round(cost * 100) / 100,
    profit: Math.round((revenue - cost) * 100) / 100,
    margin: revenue ? Math.round(((revenue - cost) / revenue) * 10000) / 100 : 0,
  };
}

export type InventoryStatus = "healthy" | "warning" | "low" | "out";

export function classifyInventory(currentStock: number, minimumStock: number): InventoryStatus {
  if (currentStock <= 0) return "out";
  if (minimumStock > 0 && currentStock < minimumStock) return "low";
  if (minimumStock > 0 && currentStock < minimumStock * 1.5) return "warning";
  return "healthy";
}

export function weightedForecast(values: number[], horizon: number) {
  const recent = values.filter((value) => value > 0).slice(-7);
  const average = recent.length ? recent.reduce((sum, value) => sum + value, 0) / recent.length : 0;
  return Array.from({ length: horizon }, (_, index) => Math.round(average * (1 + Math.min(index, 30) * 0.012) * 100) / 100);
}

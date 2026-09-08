import { createHash } from "node:crypto";

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

export function calculateGrowth(current: number, prior: number): number | null {
  if (prior === 0) return current === 0 ? 0 : null;
  return Math.round(((current - prior) / prior) * 10000) / 100;
}

export function makeSaleSourceHash(input: { date: Date; productName: string; quantity: number; unitPrice: number; unitCost: number; customerExternalId: string }) {
  return createHash("sha256").update([
    input.date.toISOString(), input.productName.trim().toLowerCase(), input.quantity, input.unitPrice.toFixed(2), input.unitCost.toFixed(2), input.customerExternalId.trim().toLowerCase(),
  ].join("|"), "utf8").digest("hex");
}

type CustomerMetricCustomer = { id: number };
type CustomerMetricSale = { customerId: number | null; quantity: number | string; revenue: number | string; profit: number | string; saleDate: Date | string };

export function aggregateCustomerMetrics<T extends CustomerMetricCustomer>(customers: T[], sales: CustomerMetricSale[]) {
  const byCustomer = new Map<number, { orders: number; quantity: number; revenue: number; profit: number; firstPurchase: Date | null; lastPurchase: Date | null }>();
  for (const sale of sales) {
    if (!sale.customerId) continue;
    const current = byCustomer.get(sale.customerId) ?? { orders: 0, quantity: 0, revenue: 0, profit: 0, firstPurchase: null, lastPurchase: null };
    const date = new Date(sale.saleDate);
    current.orders += 1;
    current.quantity += Number(sale.quantity) || 0;
    current.revenue += Number(sale.revenue) || 0;
    current.profit += Number(sale.profit) || 0;
    if (!current.firstPurchase || date < current.firstPurchase) current.firstPurchase = date;
    if (!current.lastPurchase || date > current.lastPurchase) current.lastPurchase = date;
    byCustomer.set(sale.customerId, current);
  }
  return customers.map((customer) => {
    const metrics = byCustomer.get(customer.id) ?? { orders: 0, quantity: 0, revenue: 0, profit: 0, firstPurchase: null, lastPurchase: null };
    return {
      ...customer,
      orderCount: metrics.orders,
      quantity: metrics.quantity,
      revenue: Math.round(metrics.revenue * 100) / 100,
      profit: Math.round(metrics.profit * 100) / 100,
      firstPurchase: metrics.firstPurchase,
      lastPurchase: metrics.lastPurchase,
      isReturning: metrics.orders > 1,
    };
  });
}

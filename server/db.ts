import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  alerts,
  auditLogs,
  businesses,
  customers,
  forecasts,
  insights,
  inventory,
  products,
  sales,
  uploads,
  users,
  type InsertUser,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  values.lastSignedIn ??= new Date();
  updateSet.lastSignedIn ??= new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getOrCreateBusiness(ownerId: number, ownerName?: string | null) {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select().from(businesses).where(eq(businesses.ownerId, ownerId)).limit(1);
  if (existing[0]) return existing[0];
  const label = ownerName?.trim() ? `${ownerName.trim()}'s workspace` : "My business workspace";
  await db.insert(businesses).values({ ownerId, name: label, type: "Cafe", location: "Not set" });
  const created = await db.select().from(businesses).where(eq(businesses.ownerId, ownerId)).limit(1);
  return created[0] ?? null;
}

export async function getBusinessForUser(userId: number) {
  return getOrCreateBusiness(userId);
}

export async function logAudit(input: {
  businessId: number;
  userId: number;
  action: string;
  entityType?: string;
  entityId?: number;
  metadata?: unknown;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLogs).values({
    businessId: input.businessId,
    userId: input.userId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
  });
}

const numeric = (value: unknown) => Number(value ?? 0) || 0;
const round = (value: number) => Math.round(value * 100) / 100;

export async function getDashboardSnapshot(userId: number) {
  const db = await getDb();
  const business = await getOrCreateBusiness(userId);
  if (!db || !business) {
    return {
      business: business ?? { id: 0, name: "My business workspace", type: "Cafe", currency: "INR" },
      summary: { revenue: 0, profit: 0, orders: 0, averageOrderValue: 0, customers: 0, inventoryRisk: 0 },
      revenueSeries: [],
      topProducts: [],
      categoryMix: [],
      inventory: [],
      alerts: [],
      insights: [],
      forecasts: [],
      uploads: [],
      recentSales: [],
    };
  }

  const [productRows, inventoryRows, saleRows, customerRows, alertRows, insightRows, forecastRows, uploadRows] =
    await Promise.all([
      db.select().from(products).where(eq(products.businessId, business.id)),
      db.select().from(inventory).where(eq(inventory.businessId, business.id)),
      db.select().from(sales).where(eq(sales.businessId, business.id)).orderBy(desc(sales.saleDate)),
      db.select().from(customers).where(eq(customers.businessId, business.id)),
      db.select().from(alerts).where(and(eq(alerts.businessId, business.id), eq(alerts.status, "open"))).orderBy(desc(alerts.createdAt)),
      db.select().from(insights).where(eq(insights.businessId, business.id)).orderBy(desc(insights.createdAt)),
      db.select().from(forecasts).where(eq(forecasts.businessId, business.id)).orderBy(desc(forecasts.forecastDate)),
      db.select().from(uploads).where(eq(uploads.businessId, business.id)).orderBy(desc(uploads.createdAt)),
    ]);

  const productMap = new Map(productRows.map((product) => [product.id, product]));
  const totals = saleRows.reduce(
    (acc, sale) => {
      acc.revenue += numeric(sale.revenue);
      acc.profit += numeric(sale.profit);
      acc.quantity += numeric(sale.quantity);
      return acc;
    },
    { revenue: 0, profit: 0, quantity: 0 },
  );

  const byProduct = new Map<number, { productId: number; name: string; category: string; quantity: number; revenue: number; profit: number }>();
  const byCategory = new Map<string, number>();
  const byDate = new Map<string, number>();
  for (const sale of saleRows) {
    const product = productMap.get(sale.productId);
    const current = byProduct.get(sale.productId) ?? {
      productId: sale.productId,
      name: product?.name ?? "Unmapped product",
      category: product?.category ?? "General",
      quantity: 0,
      revenue: 0,
      profit: 0,
    };
    current.quantity += numeric(sale.quantity);
    current.revenue += numeric(sale.revenue);
    current.profit += numeric(sale.profit);
    byProduct.set(sale.productId, current);
    const category = product?.category ?? "General";
    byCategory.set(category, (byCategory.get(category) ?? 0) + numeric(sale.revenue));
    const dateKey = new Date(sale.saleDate).toISOString().slice(0, 10);
    byDate.set(dateKey, (byDate.get(dateKey) ?? 0) + numeric(sale.revenue));
  }

  const inventoryView = inventoryRows.map((item) => {
    const product = productMap.get(item.productId);
    const stock = numeric(item.currentStock);
    const minimum = numeric(item.minimumStock);
    const ratio = minimum === 0 ? 1 : stock / minimum;
    const status = stock <= 0 ? "out" : ratio < 1 ? "low" : ratio < 1.5 ? "warning" : "healthy";
    return {
      ...item,
      productName: product?.name ?? "Unknown product",
      category: product?.category ?? "General",
      stock,
      minimum,
      status,
    };
  });

  const generatedAlerts = inventoryView
    .filter((item) => item.status === "out" || item.status === "low")
    .map((item) => ({
      id: `inventory-${item.id}`,
      type: "inventory",
      severity: item.status === "out" ? "critical" : "warning",
      title: item.status === "out" ? `${item.productName} is out of stock` : `${item.productName} is below minimum stock`,
      body: item.status === "out" ? "Restock this item before the next selling period." : `${item.stock} ${item.unit} left against a minimum of ${item.minimum}.`,
    }));

  const revenueSeries = Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (13 - index));
    const key = date.toISOString().slice(0, 10);
    return { date: key, label: date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }), revenue: round(byDate.get(key) ?? 0) };
  });

  const topProducts = Array.from(byProduct.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6)
    .map((product) => ({ ...product, revenue: round(product.revenue), profit: round(product.profit) }));
  const categoryMix = Array.from(byCategory.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({ name, value: round(value), share: totals.revenue ? round((value / totals.revenue) * 100) : 0 }));

  const forecastBase = revenueSeries.filter((day) => day.revenue > 0).slice(-7);
  const averageDaily = forecastBase.length ? forecastBase.reduce((sum, day) => sum + day.revenue, 0) / forecastBase.length : 0;
  const forecast = forecastRows.length
    ? forecastRows
    : Array.from({ length: 7 }, (_, index) => {
        const forecastDate = new Date();
        forecastDate.setDate(forecastDate.getDate() + index + 1);
        return {
          id: `generated-${index}`,
          forecastDate,
          predictedRevenue: round(averageDaily * (1 + index * 0.012)),
          model: "weighted moving average",
          mae: 0,
          rmse: 0,
          mape: 0,
          horizon: "7_days",
        };
      });

  const derivedInsights = [
    topProducts[0] && {
      id: "derived-product",
      type: "performance",
      title: `${topProducts[0].name} is carrying the mix`,
      body: `${topProducts[0].name} contributes ${totals.revenue ? Math.round((topProducts[0].revenue / totals.revenue) * 100) : 0}% of tracked revenue. Protect availability while reviewing margin before expanding its promotion.`,
    },
    inventoryView.find((item) => item.status === "warning") && {
      id: "derived-inventory",
      type: "inventory",
      title: "Inventory needs a closer look",
      body: `${inventoryView.filter((item) => item.status === "warning").length} item(s) are within 50% of their minimum stock threshold. Review supplier lead times before the next rush period.`,
    },
  ].filter(Boolean);

  return {
    business,
    summary: {
      revenue: round(totals.revenue),
      profit: round(totals.profit),
      orders: saleRows.length,
      averageOrderValue: saleRows.length ? round(totals.revenue / saleRows.length) : 0,
      customers: customerRows.length,
      inventoryRisk: inventoryView.filter((item) => item.status === "low" || item.status === "out").length,
      profitMargin: totals.revenue ? round((totals.profit / totals.revenue) * 100) : 0,
    },
    revenueSeries,
    topProducts,
    categoryMix,
    inventory: inventoryView,
    alerts: [...alertRows, ...generatedAlerts].slice(0, 8),
    insights: insightRows.length ? insightRows : derivedInsights,
    forecasts: forecast,
    uploads: uploadRows,
    recentSales: saleRows.slice(0, 8).map((sale) => ({ ...sale, productName: productMap.get(sale.productId)?.name ?? "Unmapped product" })),
  };
}

export async function getProductsForUser(userId: number) {
  const db = await getDb();
  const business = await getBusinessForUser(userId);
  if (!db || !business) return [];
  return db.select().from(products).where(eq(products.businessId, business.id)).orderBy(desc(products.updatedAt));
}

export async function getInventoryForUser(userId: number) {
  const snapshot = await getDashboardSnapshot(userId);
  return snapshot.inventory;
}

export async function getCustomersForUser(userId: number) {
  const db = await getDb();
  const business = await getBusinessForUser(userId);
  if (!db || !business) return [];
  return db.select().from(customers).where(eq(customers.businessId, business.id)).orderBy(desc(customers.updatedAt));
}

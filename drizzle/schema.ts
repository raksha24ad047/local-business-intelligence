import {
  boolean,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const businesses = mysqlTable("businesses", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  type: varchar("type", { length: 80 }).notNull().default("Cafe"),
  location: varchar("location", { length: 160 }),
  currency: varchar("currency", { length: 8 }).notNull().default("INR"),
  taxRate: decimal("taxRate", { precision: 6, scale: 2 }).notNull().default("5.00"),
  openingHours: varchar("openingHours", { length: 160 }).default("08:00–22:00"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  businessId: int("businessId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  category: varchar("category", { length: 80 }).notNull().default("General"),
  price: decimal("price", { precision: 12, scale: 2 }).notNull().default("0.00"),
  cost: decimal("cost", { precision: 12, scale: 2 }).notNull().default("0.00"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const inventory = mysqlTable("inventory", {
  id: int("id").autoincrement().primaryKey(),
  businessId: int("businessId").notNull(),
  productId: int("productId").notNull(),
  currentStock: decimal("currentStock", { precision: 12, scale: 2 }).notNull().default("0.00"),
  minimumStock: decimal("minimumStock", { precision: 12, scale: 2 }).notNull().default("0.00"),
  unit: varchar("unit", { length: 24 }).notNull().default("units"),
  supplier: varchar("supplier", { length: 160 }),
  lastRestocked: timestamp("lastRestocked"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  businessId: int("businessId").notNull(),
  externalId: varchar("externalId", { length: 100 }).notNull(),
  name: varchar("name", { length: 160 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const sales = mysqlTable("sales", {
  id: int("id").autoincrement().primaryKey(),
  businessId: int("businessId").notNull(),
  saleDate: timestamp("saleDate").notNull(),
  productId: int("productId").notNull(),
  customerId: int("customerId"),
  quantity: int("quantity").notNull(),
  unitPrice: decimal("unitPrice", { precision: 12, scale: 2 }).notNull(),
  unitCost: decimal("unitCost", { precision: 12, scale: 2 }).notNull(),
  revenue: decimal("revenue", { precision: 14, scale: 2 }).notNull(),
  cost: decimal("cost", { precision: 14, scale: 2 }).notNull(),
  profit: decimal("profit", { precision: 14, scale: 2 }).notNull(),
  channel: varchar("channel", { length: 40 }).default("in_store"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const uploads = mysqlTable("uploads", {
  id: int("id").autoincrement().primaryKey(),
  businessId: int("businessId").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  storageKey: varchar("storageKey", { length: 512 }),
  status: mysqlEnum("status", ["processing", "complete", "failed"]).notNull().default("processing"),
  rowsProcessed: int("rowsProcessed").notNull().default(0),
  rowsRejected: int("rowsRejected").notNull().default(0),
  validationMessage: text("validationMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const forecasts = mysqlTable("forecasts", {
  id: int("id").autoincrement().primaryKey(),
  businessId: int("businessId").notNull(),
  horizon: varchar("horizon", { length: 40 }).notNull().default("7_days"),
  forecastDate: timestamp("forecastDate").notNull(),
  predictedRevenue: decimal("predictedRevenue", { precision: 14, scale: 2 }).notNull(),
  model: varchar("model", { length: 80 }).notNull().default("weighted_moving_average"),
  mae: decimal("mae", { precision: 14, scale: 2 }).default("0.00"),
  rmse: decimal("rmse", { precision: 14, scale: 2 }).default("0.00"),
  mape: decimal("mape", { precision: 8, scale: 2 }).default("0.00"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const alerts = mysqlTable("alerts", {
  id: int("id").autoincrement().primaryKey(),
  businessId: int("businessId").notNull(),
  type: varchar("type", { length: 60 }).notNull(),
  severity: mysqlEnum("severity", ["info", "warning", "critical"]).notNull().default("info"),
  title: varchar("title", { length: 180 }).notNull(),
  body: text("body").notNull(),
  status: mysqlEnum("status", ["open", "dismissed"]).notNull().default("open"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const insights = mysqlTable("insights", {
  id: int("id").autoincrement().primaryKey(),
  businessId: int("businessId").notNull(),
  type: varchar("type", { length: 60 }).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  body: text("body").notNull(),
  status: mysqlEnum("status", ["new", "read", "archived"]).notNull().default("new"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  businessId: int("businessId").notNull(),
  userId: int("userId").notNull(),
  action: varchar("action", { length: 120 }).notNull(),
  entityType: varchar("entityType", { length: 80 }),
  entityId: int("entityId"),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Business = typeof businesses.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Inventory = typeof inventory.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type Insight = typeof insights.$inferSelect;

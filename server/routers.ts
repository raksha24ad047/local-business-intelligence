import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import * as XLSX from "xlsx";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  alerts,
  businesses,
  customers,
  forecasts,
  inventory,
  products,
  sales,
  uploads,
} from "../drizzle/schema";
import {
  getBusinessForUser,
  getCustomersForUser,
  getDashboardSnapshot,
  getDb,
  getInventoryForUser,
  getProductsForUser,
  logAudit,
} from "./db";
import { storagePut } from "./storage";
import { computeSaleTotals, weightedForecast } from "./business-logic";

const numberInput = z.union([z.number(), z.string()]).transform((value) => Number(value));
const money = (value: number) => Math.round(value * 100) / 100;

async function requireBusiness(userId: number) {
  const business = await getBusinessForUser(userId);
  if (!business) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Database is not available yet." });
  return business;
}

function extractText(response: Awaited<ReturnType<typeof invokeLLM>>) {
  const content = response.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => ("text" in part ? part.text : "")).join("\n");
  return "I couldn't generate an answer from the current business data.";
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  business: router({
    current: protectedProcedure.query(({ ctx }) => requireBusiness(ctx.user.id)),
    update: protectedProcedure
      .input(
        z.object({
          name: z.string().min(2),
          type: z.string().min(2),
          location: z.string().optional(),
          currency: z.string().min(3).max(8),
          taxRate: numberInput,
          openingHours: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const business = await requireBusiness(ctx.user.id);
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        await db.update(businesses).set({ ...input, taxRate: input.taxRate.toFixed(2) }).where(eq(businesses.id, business.id));
        await logAudit({ businessId: business.id, userId: ctx.user.id, action: "Updated business settings", entityType: "business", entityId: business.id });
        return db.select().from(businesses).where(eq(businesses.id, business.id)).limit(1).then((rows) => rows[0]);
      }),
  }),

  dashboard: router({
    snapshot: protectedProcedure.query(({ ctx }) => getDashboardSnapshot(ctx.user.id)),
  }),

  products: router({
    list: protectedProcedure.query(({ ctx }) => getProductsForUser(ctx.user.id)),
    create: protectedProcedure
      .input(z.object({ name: z.string().min(1), category: z.string().min(1), price: numberInput, cost: numberInput }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const business = await requireBusiness(ctx.user.id);
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        const result = await db.insert(products).values({ businessId: business.id, name: input.name, category: input.category, price: input.price.toFixed(2), cost: input.cost.toFixed(2) });
        await logAudit({ businessId: business.id, userId: ctx.user.id, action: "Created product", entityType: "product", entityId: Number(result[0].insertId) });
        return { success: true };
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number(), name: z.string().min(1), category: z.string().min(1), price: numberInput, cost: numberInput, active: z.boolean().optional() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const business = await requireBusiness(ctx.user.id);
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        await db.update(products).set({ name: input.name, category: input.category, price: input.price.toFixed(2), cost: input.cost.toFixed(2), active: input.active ?? true }).where(and(eq(products.id, input.id), eq(products.businessId, business.id)));
        await logAudit({ businessId: business.id, userId: ctx.user.id, action: "Updated product", entityType: "product", entityId: input.id });
        return { success: true };
      }),
  }),

  inventory: router({
    list: protectedProcedure.query(({ ctx }) => getInventoryForUser(ctx.user.id)),
    upsert: protectedProcedure
      .input(z.object({ productId: z.number(), currentStock: numberInput, minimumStock: numberInput, unit: z.string().min(1), supplier: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const business = await requireBusiness(ctx.user.id);
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        const existing = await db.select().from(inventory).where(and(eq(inventory.businessId, business.id), eq(inventory.productId, input.productId))).limit(1);
        if (existing[0]) {
          await db.update(inventory).set({ currentStock: input.currentStock.toFixed(2), minimumStock: input.minimumStock.toFixed(2), unit: input.unit, supplier: input.supplier }).where(eq(inventory.id, existing[0].id));
        } else {
          await db.insert(inventory).values({ businessId: business.id, productId: input.productId, currentStock: input.currentStock.toFixed(2), minimumStock: input.minimumStock.toFixed(2), unit: input.unit, supplier: input.supplier, lastRestocked: new Date() });
        }
        await logAudit({ businessId: business.id, userId: ctx.user.id, action: "Updated inventory", entityType: "inventory", entityId: input.productId });
        return { success: true };
      }),
  }),

  customers: router({
    list: protectedProcedure.query(({ ctx }) => getCustomersForUser(ctx.user.id)),
  }),

  sales: router({
    create: protectedProcedure
      .input(z.object({ date: z.coerce.date(), productId: z.number(), customerExternalId: z.string().optional(), quantity: z.number().int().positive(), unitPrice: numberInput, unitCost: numberInput, channel: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const business = await requireBusiness(ctx.user.id);
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        let customerId: number | undefined;
        if (input.customerExternalId?.trim()) {
          const externalId = input.customerExternalId.trim();
          const existing = await db.select().from(customers).where(and(eq(customers.businessId, business.id), eq(customers.externalId, externalId))).limit(1);
          if (existing[0]) customerId = existing[0].id;
          else {
            const created = await db.insert(customers).values({ businessId: business.id, externalId });
            customerId = Number(created[0].insertId);
          }
        }
        const totals = computeSaleTotals(input.quantity, input.unitPrice, input.unitCost);
        const result = await db.insert(sales).values({ businessId: business.id, saleDate: input.date, productId: input.productId, customerId, quantity: input.quantity, unitPrice: input.unitPrice.toFixed(2), unitCost: input.unitCost.toFixed(2), revenue: totals.revenue.toFixed(2), cost: totals.cost.toFixed(2), profit: totals.profit.toFixed(2), channel: input.channel ?? "in_store" });
        await logAudit({ businessId: business.id, userId: ctx.user.id, action: "Added sale", entityType: "sale", entityId: Number(result[0].insertId) });
        return { success: true };
      }),

    upload: protectedProcedure
      .input(z.object({ fileName: z.string().min(1), mimeType: z.string().optional(), contentBase64: z.string().min(20) }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const business = await requireBusiness(ctx.user.id);
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        const buffer = Buffer.from(input.contentBase64, "base64");
        let uploadId = 0;
        try {
          const stored = await storagePut(`${business.id}-uploads/${Date.now()}-${input.fileName.replace(/[^a-zA-Z0-9._-]/g, "-")}`, buffer, input.mimeType ?? "application/octet-stream");
          const uploadResult = await db.insert(uploads).values({ businessId: business.id, fileName: input.fileName, storageKey: stored.key, status: "processing" });
          uploadId = Number(uploadResult[0].insertId);
          const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
          const header = (rows[0] ?? []).map((cell) => String(cell).trim().toLowerCase().replace(/[^a-z0-9]/g, ""));
          const indexOf = (name: string) => header.indexOf(name);
          const dateIndex = indexOf("date");
          const productIndex = indexOf("product");
          const categoryIndex = indexOf("category");
          const quantityIndex = indexOf("quantity");
          const priceIndex = indexOf("unitprice");
          const costIndex = indexOf("cost") >= 0 ? indexOf("cost") : indexOf("unitcost");
          const customerIndex = indexOf("customerid");
          if ([dateIndex, productIndex, quantityIndex, priceIndex, costIndex].some((value) => value < 0)) {
            throw new Error("Missing required columns. Use Date, Product, Category, Quantity, UnitPrice, Cost, CustomerID.");
          }
          const existingProducts = await db.select().from(products).where(eq(products.businessId, business.id));
          const productCache = new Map(existingProducts.map((product) => [product.name.trim().toLowerCase(), product]));
          const existingCustomers = await db.select().from(customers).where(eq(customers.businessId, business.id));
          const customerCache = new Map(existingCustomers.map((customer) => [customer.externalId, customer]));
          const saleValues: Array<typeof sales.$inferInsert> = [];
          let rejected = 0;
          for (const row of rows.slice(1)) {
            const productName = String(row[productIndex] ?? "").trim();
            const rawDate = row[dateIndex];
            const parsedDate = rawDate instanceof Date ? rawDate : new Date(String(rawDate));
            const quantity = Number(row[quantityIndex]);
            const unitPrice = Number(row[priceIndex]);
            const unitCost = Number(row[costIndex]);
            if (!productName || Number.isNaN(parsedDate.getTime()) || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0 || !Number.isFinite(unitCost) || unitCost < 0) {
              rejected += 1;
              continue;
            }
            let product = productCache.get(productName.toLowerCase());
            if (!product) {
              const created = await db.insert(products).values({ businessId: business.id, name: productName, category: String(row[categoryIndex] ?? "General").trim() || "General", price: unitPrice.toFixed(2), cost: unitCost.toFixed(2) });
              const productRows = await db.select().from(products).where(eq(products.id, Number(created[0].insertId))).limit(1);
              product = productRows[0];
              if (product) productCache.set(productName.toLowerCase(), product);
            }
            if (!product) {
              rejected += 1;
              continue;
            }
            const externalCustomerId = customerIndex >= 0 ? String(row[customerIndex] ?? "").trim() : "";
            let customerId: number | undefined;
            if (externalCustomerId) {
              let customer = customerCache.get(externalCustomerId);
              if (!customer) {
                const created = await db.insert(customers).values({ businessId: business.id, externalId: externalCustomerId });
                const customerRows = await db.select().from(customers).where(eq(customers.id, Number(created[0].insertId))).limit(1);
                customer = customerRows[0];
                if (customer) customerCache.set(externalCustomerId, customer);
              }
              customerId = customer?.id;
            }
            const revenue = quantity * unitPrice;
            const cost = quantity * unitCost;
            saleValues.push({ businessId: business.id, saleDate: parsedDate, productId: product.id, customerId, quantity: Math.round(quantity), unitPrice: unitPrice.toFixed(2), unitCost: unitCost.toFixed(2), revenue: revenue.toFixed(2), cost: cost.toFixed(2), profit: (revenue - cost).toFixed(2), channel: "import" });
          }
          if (saleValues.length) await db.insert(sales).values(saleValues);
          await db.update(uploads).set({ status: "complete", rowsProcessed: saleValues.length, rowsRejected: rejected, validationMessage: rejected ? `${rejected} rows were skipped because they had invalid dates, quantities, prices, or missing product names.` : "All rows processed successfully." }).where(eq(uploads.id, uploadId));
          await logAudit({ businessId: business.id, userId: ctx.user.id, action: "Uploaded sales data", entityType: "upload", entityId: uploadId, metadata: { fileName: input.fileName, rowsProcessed: saleValues.length, rowsRejected: rejected } });
          return { success: true, rowsProcessed: saleValues.length, rowsRejected: rejected };
        } catch (error) {
          if (uploadId) await db.update(uploads).set({ status: "failed", validationMessage: error instanceof Error ? error.message : "Upload failed." }).where(eq(uploads.id, uploadId));
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Upload failed." });
        }
      }),
  }),

  forecast: router({
    generate: protectedProcedure
      .input(z.object({ horizon: z.enum(["7_days", "30_days", "3_months"]).default("7_days") }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const business = await requireBusiness(ctx.user.id);
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        const snapshot = await getDashboardSnapshot(ctx.user.id);
        const activeDays = snapshot.revenueSeries.filter((day) => day.revenue > 0).slice(-7);
        const average = activeDays.length ? activeDays.reduce((sum, day) => sum + day.revenue, 0) / activeDays.length : 0;
        const count = input.horizon === "7_days" ? 7 : input.horizon === "30_days" ? 30 : 90;
        const predictedValues = weightedForecast(activeDays.map((day) => day.revenue), count);
        const rows = Array.from({ length: count }, (_, index) => {
          const date = new Date();
          date.setDate(date.getDate() + index + 1);
          const predicted = predictedValues[index] ?? average;
          return { businessId: business.id, horizon: input.horizon, forecastDate: date, predictedRevenue: money(predicted).toFixed(2), model: "weighted moving average", mae: "0.00", rmse: "0.00", mape: "0.00" };
        });
        await db.insert(forecasts).values(rows);
        await logAudit({ businessId: business.id, userId: ctx.user.id, action: "Generated forecast", entityType: "forecast", metadata: { horizon: input.horizon } });
        return { success: true, days: count };
      }),
  }),

  alerts: router({
    dismiss: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const business = await requireBusiness(ctx.user.id);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.update(alerts).set({ status: "dismissed" }).where(and(eq(alerts.id, input.id), eq(alerts.businessId, business.id)));
      return { success: true };
    }),
  }),

  ai: router({
    query: protectedProcedure
      .input(z.object({ messages: z.array(z.object({ role: z.enum(["user", "assistant", "system"]), content: z.string() })).min(1) }))
      .mutation(async ({ ctx, input }) => {
        const snapshot = await getDashboardSnapshot(ctx.user.id);
        const context = JSON.stringify({ business: snapshot.business, summary: snapshot.summary, topProducts: snapshot.topProducts, categoryMix: snapshot.categoryMix, inventory: snapshot.inventory, alerts: snapshot.alerts, forecasts: snapshot.forecasts.slice(0, 14) });
        const response = await invokeLLM({
          messages: [
            { role: "system", content: `You are LumenLedger's grounded business analyst. Answer only from the business context below. If the data is insufficient, say what is missing. Be concise, specific, and action-oriented. Never invent a number. Business context: ${context}` },
            ...input.messages,
          ],
        });
        return { content: extractText(response) };
      }),
  }),

  reports: router({
    salesCsv: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      const business = await requireBusiness(ctx.user.id);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [saleRows, productRows] = await Promise.all([
        db.select().from(sales).where(eq(sales.businessId, business.id)).orderBy(desc(sales.saleDate)),
        db.select().from(products).where(eq(products.businessId, business.id)),
      ]);
      const productMap = new Map(productRows.map((product) => [product.id, product.name]));
      const lines = ["Date,Product,Quantity,Revenue,Cost,Profit,Channel"];
      saleRows.forEach((sale) => lines.push([new Date(sale.saleDate).toISOString(), productMap.get(sale.productId) ?? "Unmapped product", sale.quantity, sale.revenue, sale.cost, sale.profit, sale.channel ?? "in_store"].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")));
      await logAudit({ businessId: business.id, userId: ctx.user.id, action: "Generated sales report", entityType: "report" });
      return { fileName: `${business.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-sales.csv`, content: lines.join("\n") };
    }),
  }),
});

export type AppRouter = typeof appRouter;

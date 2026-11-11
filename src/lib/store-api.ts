import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { jakartaDayStartIso, shiftDate } from "./format";

export type Product = Database["public"]["Tables"]["products"]["Row"];
export type Sale = Database["public"]["Tables"]["sales"]["Row"];
export type SaleItem = Database["public"]["Tables"]["sale_items"]["Row"];
export type StockMovement = Database["public"]["Tables"]["stock_movements"]["Row"] & {
  products: { name: string; unit: string } | null;
};

function unwrap<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw new Error(res.error.message);
  return res.data as NonNullable<T>;
}

export const productsQuery = () =>
  queryOptions({
    queryKey: ["products"],
    queryFn: async () =>
      unwrap(await supabase.from("products").select("*").order("category").order("name")),
  });

export const movementsQuery = () =>
  queryOptions({
    queryKey: ["stock_movements"],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("stock_movements")
          .select("*, products(name, unit)")
          .order("created_at", { ascending: false })
          .limit(100),
      ) as StockMovement[],
  });

export const PAGE_SIZE = 25;

export const salesQuery = (params: { from: string; to: string; page: number; q: string }) =>
  queryOptions({
    queryKey: ["sales", params],
    queryFn: async () => {
      let query = supabase
        .from("sales")
        .select("*", { count: "exact" })
        .gte("created_at", jakartaDayStartIso(params.from))
        .lt("created_at", jakartaDayStartIso(shiftDate(params.to, 1)))
        .order("created_at", { ascending: false })
        .range(params.page * PAGE_SIZE, params.page * PAGE_SIZE + PAGE_SIZE - 1);
      if (params.q.trim()) {
        const q = params.q.trim().replace(/[%,()]/g, "");
        query = query.or(`invoice_no.ilike.%${q}%,customer_name.ilike.%${q}%`);
      }
      const { data, error, count } = await query;
      if (error) throw new Error(error.message);
      return { rows: data ?? [], count: count ?? 0 };
    },
  });

export const saleDetailQuery = (id: string) =>
  queryOptions({
    queryKey: ["sale", id],
    queryFn: async () => {
      const sale = unwrap(await supabase.from("sales").select("*").eq("id", id).single());
      const items = unwrap(await supabase.from("sale_items").select("*").eq("sale_id", id));
      return { sale, items };
    },
  });

export const dailyQuery = (from: string, to: string) =>
  queryOptions({
    queryKey: ["report", "daily", from, to],
    queryFn: async () =>
      unwrap(await supabase.rpc("sales_daily", { _from: from, _to: to })).map((r) => ({
        day: r.day,
        revenue: Number(r.revenue),
        profit: Number(r.profit),
        transactions: Number(r.transactions),
      })),
  });

export const topProductsQuery = (from: string, to: string, limit = 10) =>
  queryOptions({
    queryKey: ["report", "top", from, to, limit],
    queryFn: async () =>
      unwrap(await supabase.rpc("top_products", { _from: from, _to: to, _limit: limit })).map((r) => ({
        ...r,
        quantity: Number(r.quantity),
        revenue: Number(r.revenue),
        profit: Number(r.profit),
      })),
  });

export const paymentQuery = (from: string, to: string) =>
  queryOptions({
    queryKey: ["report", "payment", from, to],
    queryFn: async () =>
      unwrap(await supabase.rpc("payment_breakdown", { _from: from, _to: to })).map((r) => ({
        ...r,
        transactions: Number(r.transactions),
        revenue: Number(r.revenue),
      })),
  });

export const recentSalesQuery = () =>
  queryOptions({
    queryKey: ["sales", "recent"],
    queryFn: async () =>
      unwrap(await supabase.from("sales").select("*").order("created_at", { ascending: false }).limit(6)),
  });

export async function createSale(input: {
  items: { product_id: string; quantity: number }[];
  paid: number;
  method: string;
  customer: string;
}) {
  return unwrap(
    await supabase.rpc("create_sale", {
      _items: input.items,
      _paid: input.paid,
      _method: input.method,
      _customer: input.customer,
    }),
  );
}

export async function adjustStock(input: {
  productId: string;
  type: "in" | "out" | "adjust";
  quantity: number;
  note: string;
}) {
  return unwrap(
    await supabase.rpc("adjust_stock", {
      _product_id: input.productId,
      _type: input.type,
      _quantity: input.quantity,
      _note: input.note,
    }),
  );
}

import { SupabaseClient } from "@supabase/supabase-js";
import { NotFoundError, ForbiddenError } from "../lib/errors";

async function getOrCreateSellerStore(
  supabase: SupabaseClient,
  sellerId: string,
) {
  const { data: existing, error: findError } = await supabase
    .from("stores")
    .select("id")
    .eq("owner_id", sellerId)
    .limit(1)
    .maybeSingle();

  if (findError) throw findError;
  if (existing) return existing.id;

  // Assumption: one store per seller, auto-created on first product.
  // See README for reasoning.
  const { data: created, error: createError } = await supabase
    .from("stores")
    .insert({ owner_id: sellerId, name: "My Store" })
    .select("id")
    .single();

  if (createError) throw createError;
  return created.id;
}

export async function createProduct(
  supabase: SupabaseClient,
  sellerId: string,
  input: {
    name: string;
    description?: string;
    category?: string;
    price_cents: number;
    initial_stock: number;
  },
) {
  const storeId = await getOrCreateSellerStore(supabase, sellerId);

  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({
      store_id: storeId,
      name: input.name,
      description: input.description,
      category: input.category,
      price_cents: input.price_cents,
    })
    .select()
    .single();

  if (productError) throw productError;

  const { error: inventoryError } = await supabase
    .from("inventory")
    .insert({ product_id: product.id, stock: input.initial_stock });

  if (inventoryError) throw inventoryError;

  return product;
}

export async function listProducts(
  supabase: SupabaseClient,
  query: {
    page: number;
    limit: number;
    search?: string;
    category?: string;
    min_price?: number;
    max_price?: number;
    available?: boolean;
    sort_by: "price_cents" | "created_at" | "name";
    sort_dir: "asc" | "desc";
  },
) {
  let q = supabase
    .from("products")
    .select("*", { count: "exact" })
    .eq("is_archived", false);

  if (query.search) {
    q = q.ilike("name", `%${query.search}%`);
  }
  if (query.category) {
    q = q.eq("category", query.category);
  }
  if (query.min_price !== undefined) {
    q = q.gte("price_cents", query.min_price);
  }
  if (query.max_price !== undefined) {
    q = q.lte("price_cents", query.max_price);
  }
  if (query.available !== undefined) {
    q = q.eq("is_available", query.available);
  }

  q = q.order(query.sort_by, { ascending: query.sort_dir === "asc" });

  const from = (query.page - 1) * query.limit;
  const to = from + query.limit - 1;
  q = q.range(from, to);

  const { data, error, count } = await q;
  if (error) throw error;

  return {
    data,
    pagination: {
      page: query.page,
      limit: query.limit,
      total: count ?? 0,
      total_pages: count ? Math.ceil(count / query.limit) : 0,
    },
  };
}

export async function getProduct(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new NotFoundError("Product not found");
  return data;
}

export async function updateProduct(
  supabase: SupabaseClient,
  id: string,
  input: Partial<{
    name: string;
    description: string;
    category: string;
    price_cents: number;
    is_available: boolean;
    is_archived: boolean;
  }>,
) {
  const { data, error } = await supabase
    .from("products")
    .update(input)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) throw error;
  // RLS silently returns no row if this product isn't owned by the caller,
  // rather than an explicit error — we translate that into a clean 404 here
  // so we don't leak whether the product exists at all to a non-owner.
  if (!data) throw new NotFoundError("Product not found");
  return data;
}

export async function archiveProduct(supabase: SupabaseClient, id: string) {
  return updateProduct(supabase, id, {
    is_archived: true,
    is_available: false,
  });
}

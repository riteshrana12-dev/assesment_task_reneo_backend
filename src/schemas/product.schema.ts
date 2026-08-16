import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
  price_cents: z.number().int().nonnegative("Price cannot be negative"),
  initial_stock: z.number().int().nonnegative().default(0),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
  price_cents: z.number().int().nonnegative().optional(),
  is_available: z.boolean().optional(),
  is_archived: z.boolean().optional(),
});

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().max(200).optional(),
  category: z.string().max(100).optional(),
  min_price: z.coerce.number().int().nonnegative().optional(),
  max_price: z.coerce.number().int().nonnegative().optional(),
  available: z.coerce.boolean().optional(),
  sort_by: z.enum(["price_cents", "created_at", "name"]).default("created_at"),
  sort_dir: z.enum(["asc", "desc"]).default("desc"),
});

export const productIdParamSchema = z.object({
  id: z.string().uuid("Invalid product id"),
});

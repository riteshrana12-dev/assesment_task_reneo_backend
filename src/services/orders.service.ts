import { SupabaseClient } from "@supabase/supabase-js";
import {
  ConflictError,
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from "../lib/errors";

interface OrderItemInput {
  product_id: string;
  quantity: number;
}

export async function createOrder(
  supabase: SupabaseClient,
  items: OrderItemInput[],
  idempotencyKey?: string,
) {
  const { data, error } = await supabase.rpc("create_order", {
    p_items: items,
    p_idempotency_key: idempotencyKey ?? null,
  });

  if (error) {
    // Map known Postgres exception messages (raised in 0009_create_order_function.sql)
    // to the right HTTP error. See errorHandler.ts for the same mapping applied
    // as a safety net — this is the primary, intentional mapping point.
    if (error.message.includes("Insufficient stock")) {
      throw new ConflictError(error.message);
    }
    if (error.message.includes("not available")) {
      throw new NotFoundError(error.message);
    }
    if (error.message.includes("Only customers")) {
      throw new ForbiddenError(error.message);
    }
    if (error.message.includes("Invalid quantity")) {
      throw new BadRequestError(error.message);
    }
    throw error;
  }

  return data; // the new order's id, returned by the SQL function
}

export async function getOrder(supabase: SupabaseClient, orderId: string) {
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) throw orderError;
  if (!order) throw new NotFoundError("Order not found");

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId);

  if (itemsError) throw itemsError;

  return { ...order, items };
}

export async function listMyOrders(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

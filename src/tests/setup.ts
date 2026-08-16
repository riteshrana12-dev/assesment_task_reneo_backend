import request from "supertest";
import { createApp } from "../app";
import { getSupabaseAdmin, createUserClient } from "../config/supabase";

export const app = createApp();

export async function signIn(email: string, password: string) {
  const client = createUserClient("");
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.session)
    throw new Error(`Sign-in failed for ${email}: ${error?.message}`);
  return data.session.access_token;
}

export async function setStock(productId: string, stock: number) {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("inventory")
    .update({ stock })
    .eq("product_id", productId);
  if (error) throw error;
}

export async function createTestProduct(
  sellerToken: string,
  priceCents = 5000,
  initialStock = 10,
) {
  const res = await request(app)
    .post("/products")
    .set("Authorization", `Bearer ${sellerToken}`)
    .send({
      name: "Test Product",
      price_cents: priceCents,
      initial_stock: initialStock,
    });
  return res.body.data.id as string;
}

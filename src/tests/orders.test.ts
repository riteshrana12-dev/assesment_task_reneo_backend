import request from "supertest";
import { app, signIn, setStock, createTestProduct } from "./setup";
import { getSupabaseAdmin } from "../config/supabase";

describe("Orders — availability and stock enforcement", () => {
  it("Scenario 3: Customer orders an available product — success", async () => {
    const sellerToken = await signIn("seller1@test.com", "TestPass123!");
    const customerToken = await signIn("customer1@test.com", "TestPass123!");

    const productId = await createTestProduct(sellerToken, 4000, 10);

    const res = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ items: [{ product_id: productId, quantity: 2 }] });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("CONFIRMED");
    expect(res.body.data.total_cents).toBe(8000); // 2 * 4000
  });

  it("Scenario 4: Customer orders more than available stock — denied", async () => {
    const sellerToken = await signIn("seller1@test.com", "TestPass123!");
    const customerToken = await signIn("customer1@test.com", "TestPass123!");

    const productId = await createTestProduct(sellerToken, 4000, 3);

    const res = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ items: [{ product_id: productId, quantity: 10 }] });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  it("B2: idempotent order creation — same key returns the same order, does not double-charge stock", async () => {
    const sellerToken = await signIn("seller1@test.com", "TestPass123!");
    const customerToken = await signIn("customer1@test.com", "TestPass123!");

    const productId = await createTestProduct(sellerToken, 4000, 5);
    const idempotencyKey = `test-${Date.now()}`;

    const res1 = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send({ items: [{ product_id: productId, quantity: 1 }] });

    const res2 = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send({ items: [{ product_id: productId, quantity: 1 }] });

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    expect(res1.body.data.id).toBe(res2.body.data.id);
  });

  it("B3: order creation emits an ORDER_CREATED event", async () => {
    const sellerToken = await signIn("seller1@test.com", "TestPass123!");
    const customerToken = await signIn("customer1@test.com", "TestPass123!");
    const admin = getSupabaseAdmin();

    const productId = await createTestProduct(sellerToken, 4000, 5);

    const res = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ items: [{ product_id: productId, quantity: 1 }] });

    expect(res.status).toBe(201);
    const orderId = res.body.data.id;

    const { data: events, error } = await admin
      .from("events")
      .select("*")
      .eq("order_id", orderId)
      .eq("type", "ORDER_CREATED");

    expect(error).toBeNull();
    expect(events).toHaveLength(1);
    expect(events![0].payload.order_id).toBe(orderId);
  });
});

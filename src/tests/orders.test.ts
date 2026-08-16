import request from "supertest";
import { app, signIn, setStock, createTestProduct } from "./setup";

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
});

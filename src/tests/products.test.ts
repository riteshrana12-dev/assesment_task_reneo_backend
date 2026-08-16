import request from "supertest";
import { app, signIn, createTestProduct } from "./setup";

describe("Products — ownership and access control", () => {
  it("Scenario 1: Seller A creates a product — success", async () => {
    const sellerToken = await signIn("seller1@test.com", "TestPass123!");

    const res = await request(app)
      .post("/products")
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({
        name: "Scenario 1 Product",
        price_cents: 3000,
        initial_stock: 5,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe("Scenario 1 Product");
    expect(res.body.data.price_cents).toBe(3000);
  });

  it("Scenario 2: Seller B attempts to modify Seller A's product — denied", async () => {
    const sellerAToken = await signIn("seller1@test.com", "TestPass123!");
    const sellerBToken = await signIn("seller2@test.com", "TestPass123!");

    const productId = await createTestProduct(sellerAToken);

    const res = await request(app)
      .patch(`/products/${productId}`)
      .set("Authorization", `Bearer ${sellerBToken}`)
      .send({ price_cents: 1 });

    // RLS makes a non-owned row invisible rather than returning a 403 —
    // see products.controller.ts / Task 8 for the reasoning.
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

import request from "supertest";
import { app, signIn, setStock, createTestProduct } from "./setup";

describe("B1 — concurrent stock (last item, two simultaneous orders)", () => {
  it("allows exactly one of two simultaneous orders to succeed when stock is 1", async () => {
    const sellerToken = await signIn("seller1@test.com", "TestPass123!");
    const customerToken = await signIn("customer1@test.com", "TestPass123!");

    const productId = await createTestProduct(sellerToken);
    await setStock(productId, 1);

    // Fire both requests together — Promise.all starts both before either resolves,
    // so they genuinely race at the database level rather than running sequentially.
    const [resA, resB] = await Promise.all([
      request(app)
        .post("/orders")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ items: [{ product_id: productId, quantity: 1 }] }),
      request(app)
        .post("/orders")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ items: [{ product_id: productId, quantity: 1 }] }),
    ]);

    const statuses = [resA.status, resB.status].sort();

    // Exactly one succeeds (201), exactly one is rejected as a conflict (409).
    expect(statuses).toEqual([201, 409]);

    const successRes = resA.status === 201 ? resA : resB;
    const failRes = resA.status === 201 ? resB : resA;

    expect(successRes.body.data.status).toBe("CONFIRMED");
    expect(failRes.body.error.code).toBe("CONFLICT");
  });
});

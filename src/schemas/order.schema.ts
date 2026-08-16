import { z } from "zod";

export const createOrderSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            product_id: z.string().uuid("Invalid product id"),
            quantity: z.number().int().positive("Quantity must be positive"),
          })
          .strict(),
      )
      .min(1, "Order must contain at least one item"),
  })
  .strict();

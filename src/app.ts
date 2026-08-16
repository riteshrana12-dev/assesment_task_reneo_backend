import express from "express";
import productsRouter from "./routes/products.routes";
import { errorHandler } from "./middleware/errorHandler";
import ordersRouter from "./routes/orders.routes";

export function createApp() {
  const app = express();

  app.use(express.json());

  app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

  app.use("/products", productsRouter);
  app.use("/orders", ordersRouter);

  app.use(errorHandler);

  return app;
}

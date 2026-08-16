import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../lib/asyncHandler";
import { createOrderSchema } from "../schemas/order.schema";
import * as ordersController from "../controllers/orders.controller";

const router = Router();

router.post(
  "/",
  requireAuth,
  requireRole("CUSTOMER"),
  validate(createOrderSchema),
  asyncHandler(ordersController.create),
);

router.get("/", requireAuth, asyncHandler(ordersController.listMine));

router.get("/:id", requireAuth, asyncHandler(ordersController.getOne));

export default router;

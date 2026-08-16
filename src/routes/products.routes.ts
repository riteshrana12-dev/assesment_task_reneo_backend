import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../lib/asyncHandler";
import {
  createProductSchema,
  updateProductSchema,
  listProductsQuerySchema,
  productIdParamSchema,
} from "../schemas/product.schema";
import * as productsController from "../controllers/products.controller";

const router = Router();

// Public-ish (still requires auth in this brief, no anonymous browsing defined) — list/read
router.get(
  "/",
  requireAuth,
  validate(listProductsQuerySchema, "query"),
  asyncHandler(productsController.list),
);

router.get(
  "/:id",
  requireAuth,
  validate(productIdParamSchema, "params"),
  asyncHandler(productsController.getOne),
);

// Seller-only — write operations
router.post(
  "/",
  requireAuth,
  requireRole("SELLER"),
  validate(createProductSchema),
  asyncHandler(productsController.create),
);

router.patch(
  "/:id",
  requireAuth,
  requireRole("SELLER"),
  validate(productIdParamSchema, "params"),
  validate(updateProductSchema),
  asyncHandler(productsController.update),
);

router.delete(
  "/:id",
  requireAuth,
  requireRole("SELLER"),
  validate(productIdParamSchema, "params"),
  asyncHandler(productsController.archive),
);

export default router;

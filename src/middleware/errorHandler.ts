import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/errors";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    });
  }

  // Supabase/Postgres errors sometimes arrive as plain objects with a `code`/`message`,
  // not thrown as our AppError classes — map the common ones we expect from create_order().
  if (typeof err === "object" && err !== null && "message" in err) {
    const message = String((err as { message: unknown }).message);

    if (message.includes("Insufficient stock")) {
      return res.status(409).json({ error: { code: "CONFLICT", message } });
    }
    if (message.includes("not available")) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message } });
    }
    if (message.includes("Not authenticated")) {
      return res
        .status(401)
        .json({ error: { code: "UNAUTHENTICATED", message } });
    }
    if (message.includes("Only customers")) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message } });
    }
  }

  console.error("Unhandled error:", err);
  return res.status(500).json({
    error: { code: "INTERNAL", message: "Something went wrong" },
  });
}

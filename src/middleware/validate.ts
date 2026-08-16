import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import { BadRequestError } from "../lib/errors";

type Source = "body" | "query" | "params";

export function validate(schema: ZodSchema, source: Source = "body") {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const message = result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      return next(new BadRequestError(message));
    }

    if (source === "query") {
      // Express 5 makes req.query a read-only getter — can't reassign it.
      // Mutate the existing object in place instead, and stash the
      // validated/coerced version separately for anything that wants it clean.
      Object.assign(req.query, result.data);
      (req as any).validatedQuery = result.data;
    } else {
      req[source] = result.data;
    }

    next();
  };
}

import { Request, Response, NextFunction } from "express";
import { createUserClient } from "../config/supabase";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: {
        code: "UNAUTHENTICATED",
        message: "Missing or invalid Authorization header",
      },
    });
  }

  const token = authHeader.slice("Bearer ".length);
  const supabase = createUserClient(token);

  const { data: userData, error: userError } =
    await supabase.auth.getUser(token);

  if (userError || !userData?.user) {
    return res.status(401).json({
      error: { code: "UNAUTHENTICATED", message: "Invalid or expired token" },
    });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", userData.user.id)
    .single();

  if (profileError || !profile) {
    return res.status(403).json({
      error: { code: "FORBIDDEN", message: "No profile found for this user" },
    });
  }

  req.user = { id: profile.id, role: profile.role as "SELLER" | "CUSTOMER" };
  req.supabase = supabase;

  return next();
}

export function requireRole(role: "SELLER" | "CUSTOMER") {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: { code: "UNAUTHENTICATED", message: "Not authenticated" },
      });
    }
    if (req.user.role !== role) {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: `Requires ${role} role` },
      });
    }
    return next();
  };
}

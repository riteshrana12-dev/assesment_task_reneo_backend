import { SupabaseClient } from "@supabase/supabase-js";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: "SELLER" | "CUSTOMER";
      };
      supabase?: SupabaseClient;
    }
  }
}

export {};

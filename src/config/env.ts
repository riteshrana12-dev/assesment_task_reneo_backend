import path from "path";
import dotenv from "dotenv";

// Load .env from the project root regardless of the current working directory.
// dotenv.config() defaults to `process.cwd()/.env`, which breaks when the
// process is started from a subfolder (e.g. `cd src && npx ts-node scripts/...`).
dotenv.config({
  path: path.join(__dirname, "../../.env"),
});

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  SUPABASE_URL: requireEnv("SUPABASE_URL"),
  SUPABASE_ANON_KEY: requireEnv("SUPABASE_ANON_KEY"),
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY, // optional for now
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
};

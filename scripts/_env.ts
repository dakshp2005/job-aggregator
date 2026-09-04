import { config } from "dotenv";
import { existsSync } from "node:fs";

// Load .env.local then .env (local wins). In CI, real env vars are already set.
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) config({ path: file, override: false });
}

export function requireEnv(keys: string[]) {
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Missing required env vars: ${missing.join(", ")}`);
    process.exit(1);
  }
}

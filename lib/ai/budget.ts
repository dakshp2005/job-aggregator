import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

const DAILY_BUDGET = Number(process.env.AI_DAILY_CALL_BUDGET ?? 800);

type Admin = SupabaseClient<Database>;

export class AiBudgetError extends Error {
  constructor() {
    super("AI daily budget reached — falling back to structured sources only.");
    this.name = "AiBudgetError";
  }
}

export async function assertAiBudget(admin: Admin): Promise<void> {
  const { data, error } = await admin.rpc("get_ai_usage");
  if (error) return; // fail open — don't block ingestion on a metering hiccup
  if ((data ?? 0) >= DAILY_BUDGET) throw new AiBudgetError();
}

export async function recordAiCall(admin: Admin): Promise<number> {
  const { data } = await admin.rpc("increment_ai_usage");
  return data ?? 0;
}

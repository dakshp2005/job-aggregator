import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pinged by .github/workflows/keepalive.yml every few hours so the free
 * Supabase project never hits its 7-day inactivity pause.
 */
export async function GET() {
  try {
    const admin = createAdminClient();
    const { count, error } = await admin
      .from("companies")
      .select("id", { count: "exact", head: true });
    if (error) throw error;
    return NextResponse.json({ ok: true, companies: count ?? 0, ts: Date.now() });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

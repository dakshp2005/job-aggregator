import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestCompany } from "@/lib/ingest/run";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Backup ingestion trigger for environments without GitHub Actions
 * (e.g. Vercel Cron once/day on Hobby). Processes the most-stale companies
 * within the serverless time budget. Protected by CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 12), 40);
  const admin = createAdminClient();

  const { data: companies } = await admin
    .from("companies")
    .select("id, name, slug, ats_type, ats_slug, careers_url, tags, ai_extract_attempted_at")
    .neq("status", "error")
    .order("last_scraped_at", { ascending: true, nullsFirst: true })
    .limit(limit);

  const results = [];
  for (const c of companies ?? []) {
    results.push(await ingestCompany(admin, c));
  }

  return NextResponse.json({
    ran: results.length,
    ok: results.filter((r) => r.status === "ok").length,
    errors: results.filter((r) => r.status === "error").length,
    results,
  });
}

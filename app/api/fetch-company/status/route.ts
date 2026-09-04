import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const admin = createAdminClient();
  const { data: reqRow, error } = await admin
    .from("fetch_requests")
    .select("id, status, message, error, resolved_company_id, created_at, completed_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !reqRow) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  let slug: string | null = null;
  let jobCount = 0;
  if (reqRow.resolved_company_id) {
    const { data: c } = await admin
      .from("companies")
      .select("slug, open_jobs_count")
      .eq("id", reqRow.resolved_company_id)
      .maybeSingle();
    slug = c?.slug ?? null;
    jobCount = c?.open_jobs_count ?? 0;
  }

  return NextResponse.json(
    {
      status: reqRow.status,
      message: reqRow.message,
      error: reqRow.error,
      slug,
      jobCount,
      done: reqRow.status === "done" || reqRow.status === "failed",
    },
    { headers: { "cache-control": "no-store" } },
  );
}

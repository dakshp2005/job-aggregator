import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ companies: [] });

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 8), 25);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_companies", { q, lim: limit });

  if (error) {
    return NextResponse.json({ companies: [], error: error.message }, { status: 500 });
  }
  return NextResponse.json(
    { companies: data ?? [] },
    { headers: { "cache-control": "public, max-age=30, stale-while-revalidate=120" } },
  );
}

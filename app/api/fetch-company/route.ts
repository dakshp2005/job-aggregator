import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processFetchRequest } from "@/lib/ingest/on-demand";

export const runtime = "nodejs";
export const maxDuration = 300;

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] || req.headers.get("x-real-ip") || "0.0.0.0").trim();
}

export async function POST(req: NextRequest) {
  let query = "";
  try {
    ({ query } = await req.json());
  } catch {
    /* ignore */
  }
  query = (query || "").trim();
  if (query.length < 2) {
    return NextResponse.json({ error: "Enter at least 2 characters." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to fetch a company." }, { status: 401 });
  }

  const admin = createAdminClient();

  // Rate-limited enqueue (per-IP hourly + global daily) inside the RPC.
  const { data: requestId, error } = await admin.rpc("enqueue_fetch_request", {
    p_query: query,
    p_ip: clientIp(req),
    p_user: user?.id ?? null,
  });

  if (error || !requestId) {
    return NextResponse.json(
      { error: error?.message ?? "Could not queue the request." },
      { status: 429 },
    );
  }

  // If this request already resolved (recent duplicate), short-circuit.
  const { data: existing } = await admin
    .from("fetch_requests")
    .select("status, resolved_company_id")
    .eq("id", requestId)
    .single();

  if (existing?.status === "done" && existing.resolved_company_id) {
    const { data: c } = await admin
      .from("companies")
      .select("slug")
      .eq("id", existing.resolved_company_id)
      .single();
    return NextResponse.json({ requestId, status: "done", slug: c?.slug });
  }

  const useDispatch =
    process.env.GITHUB_DISPATCH_TOKEN && process.env.GITHUB_REPO && process.env.NODE_ENV === "production";

  if (useDispatch) {
    // Offload the heavy crawl to GitHub Actions; the client polls status.
    after(async () => {
      try {
        await fetch(
          `https://api.github.com/repos/${process.env.GITHUB_REPO}/actions/workflows/ingest-one.yml/dispatches`,
          {
            method: "POST",
            headers: {
              authorization: `Bearer ${process.env.GITHUB_DISPATCH_TOKEN}`,
              accept: "application/vnd.github+json",
              "x-github-api-version": "2022-11-28",
            },
            body: JSON.stringify({ ref: "main", inputs: { request_id: requestId, query } }),
          },
        );
      } catch {
        // Fall back to inline processing if dispatch fails.
        await processFetchRequest(admin, requestId).catch(() => {});
      }
    });
  } else {
    after(async () => {
      await processFetchRequest(admin, requestId).catch(() => {});
    });
  }

  return NextResponse.json({ requestId, status: "pending" });
}

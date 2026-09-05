import "./_env";
import { requireEnv } from "./_env";
import { createAdminClient } from "@/lib/supabase/admin";
import { processFetchRequest } from "@/lib/ingest/on-demand";
import { ingestCompany } from "@/lib/ingest/run";

requireEnv([
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
]);

function arg(name: string) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1] : process.env[name.toUpperCase().replace(/-/g, "_")];
}

/**
 * Two modes:
 *   --request-id=<uuid>   process an on-demand fetch_requests row (used by GH Actions dispatch)
 *   --slug=<company-slug> re-ingest one existing company
 *   --query="Acme Inc"    resolve + ingest a company by name (no request row)
 */
async function main() {
  const admin = createAdminClient();
  const requestId = arg("request-id") || arg("request_id");
  const slug = arg("slug");
  const query = arg("query");

  if (requestId) {
    console.log(`Processing fetch request ${requestId}…`);
    const res = await processFetchRequest(admin, requestId);
    console.log(res);
    if (res.status === "failed") process.exit(1);
    return;
  }

  if (slug) {
    const { data: company, error } = await admin
      .from("companies")
      .select("id, name, slug, ats_type, ats_slug, careers_url, tags, ai_extract_attempted_at")
      .eq("slug", slug)
      .single();
    if (error || !company) {
      console.error(`No company with slug "${slug}"`);
      process.exit(1);
    }
    const res = await ingestCompany(admin, company);
    console.log(res);
    return;
  }

  if (query) {
    // Create a synthetic request row and run the full pipeline.
    const { data: id, error } = await admin.rpc("enqueue_fetch_request", {
      p_query: query,
      p_ip: null,
      p_user: null,
    });
    if (error || !id) {
      console.error("enqueue failed:", error?.message);
      process.exit(1);
    }
    const res = await processFetchRequest(admin, id as string);
    console.log(res);
    return;
  }

  console.error("Provide --request-id=, --slug=, or --query=");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

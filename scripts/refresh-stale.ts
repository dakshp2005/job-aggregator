import "./_env";
import { requireEnv } from "./_env";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestCompany } from "@/lib/ingest/run";

requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

/**
 * Weekly hard re-check: forces a full re-scrape of every company regardless of
 * last_scraped_at, and hard-closes jobs not seen in > 21 days as a safety net
 * against feeds that silently drop postings without a diff.
 */
async function main() {
  const admin = createAdminClient();

  const { data: companies } = await admin
    .from("companies")
    .select("id, name, slug, ats_type, ats_slug, careers_url, tags")
    .neq("status", "error");

  console.log(`Refreshing ${companies?.length ?? 0} companies…`);
  for (const c of companies ?? []) {
    const res = await ingestCompany(admin, c);
    console.log(`  ${c.name}: ${res.status}`);
  }

  const cutoff = new Date(Date.now() - 21 * 24 * 3600_000).toISOString();
  const { data: closedRows } = await admin
    .from("jobs")
    .update({ is_open: false })
    .lt("last_seen_at", cutoff)
    .eq("is_open", true)
    .select("id");
  console.log(`Hard-closed ${closedRows?.length ?? 0} stale jobs (>21d unseen).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

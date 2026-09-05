import "./_env";
import { requireEnv } from "./_env";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestCompany } from "@/lib/ingest/run";

requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

function arg(name: string, fallback?: string) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1] : fallback;
}

async function main() {
  const shard = Number(arg("shard", "0"));
  const of = Number(arg("of", "1"));
  const limit = Number(arg("limit", "0")); // 0 = no cap
  const staleHours = Number(arg("stale", "0")); // only companies not scraped in N hours

  const admin = createAdminClient();

  let query = admin
    .from("companies")
    .select("id, name, slug, ats_type, ats_slug, careers_url, tags, ai_extract_attempted_at")
    .neq("status", "error")
    .order("last_scraped_at", { ascending: true, nullsFirst: true });

  if (staleHours > 0) {
    const cutoff = new Date(Date.now() - staleHours * 3600_000).toISOString();
    query = query.or(`last_scraped_at.is.null,last_scraped_at.lt.${cutoff}`);
  }
  if (limit > 0) query = query.limit(limit);

  const { data: companies, error } = await query;
  if (error) throw error;

  const shardCompanies = (companies ?? []).filter(
    (_, i) => i % Math.max(of, 1) === shard,
  );

  console.log(
    `Ingesting ${shardCompanies.length} companies (shard ${shard}/${of}, ${companies?.length ?? 0} total)…`,
  );

  let ok = 0;
  let partial = 0;
  let errored = 0;
  let added = 0;
  let closed = 0;

  for (const company of shardCompanies) {
    const res = await ingestCompany(admin, company);
    if (res.status === "ok") ok++;
    else if (res.status === "partial") partial++;
    else errored++;
    added += res.diff?.added ?? 0;
    closed += res.diff?.closed ?? 0;
    const tag =
      res.status === "ok" ? "✓" : res.status === "partial" ? "~" : "✗";
    console.log(
      `  ${tag} ${company.name.padEnd(28)} ${res.adapter.padEnd(15)} ` +
        `${res.diff ? `found ${res.diff.found} (+${res.diff.added} -${res.diff.closed})` : res.error ?? ""}`,
    );
  }

  console.log(
    `\nSummary: ${ok} ok, ${partial} partial, ${errored} errors · +${added} roles, -${closed} closed`,
  );

  // Bust the front-end caches if a deploy URL + secret are configured.
  if (process.env.NEXT_PUBLIC_SITE_URL && process.env.CRON_SECRET) {
    await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/revalidate`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.CRON_SECRET}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ paths: ["/", "/companies", "/transparency"] }),
    }).catch(() => {});
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

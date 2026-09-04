import "./_env";
import { requireEnv } from "./_env";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils";
import type { AtsType } from "@/lib/supabase/database.types";

requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

interface SeedCompany {
  name: string;
  domain?: string;
  atsType: AtsType;
  atsSlug: string;
  tags?: string[];
  hqCountry?: string;
  careersUrl?: string;
}

function load(file: string): SeedCompany[] {
  const path = join(process.cwd(), "data", file);
  return JSON.parse(readFileSync(path, "utf8"));
}

async function main() {
  const admin = createAdminClient();
  const general = load("seed-companies.general.json");
  const early = load("seed-companies.early-career.json").map((c) => ({
    ...c,
    tags: [...new Set([...(c.tags ?? []), "early-career"])],
  }));

  // Merge, de-dupe by slug (early-career tags win).
  const merged = new Map<string, SeedCompany>();
  for (const c of [...general, ...early]) {
    const slug = slugify(c.name);
    const existing = merged.get(slug);
    merged.set(slug, existing ? { ...existing, ...c, tags: [...new Set([...(existing.tags ?? []), ...(c.tags ?? [])])] } : c);
  }

  const rows = [...merged.entries()].map(([slug, c]) => ({
    name: c.name,
    slug,
    domain: c.domain ?? null,
    logo_url: c.domain ? `https://logo.clearbit.com/${c.domain}` : null,
    careers_url: c.careersUrl ?? null,
    ats_type: c.atsType,
    ats_slug: c.atsSlug,
    hq_country: c.hqCountry ?? null,
    tags: c.tags ?? [],
    is_early_career_friendly: (c.tags ?? []).includes("early-career"),
    status: "pending" as const,
    source: "seed",
  }));

  console.log(`Upserting ${rows.length} seed companies…`);
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { error } = await admin.from("companies").upsert(chunk, { onConflict: "slug" });
    if (error) {
      console.error("Upsert error:", error.message);
      process.exit(1);
    }
    process.stdout.write(`  ${Math.min(i + 100, rows.length)}/${rows.length}\r`);
  }
  console.log(`\nDone. Now run:  npm run ingest`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

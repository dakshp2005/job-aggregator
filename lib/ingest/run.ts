import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, CompanyRow, RunStatus } from "@/lib/supabase/database.types";
import { getAdapter, ADAPTERS } from "@/lib/adapters/registry";
import { DEFAULT_CONTEXT } from "@/lib/adapters/http";
import { jsonLdAdapter } from "@/lib/adapters/jsonld";
import { normalizeJob, isEarlyCareerFriendly } from "./normalize";
import { applyDiff, type DiffResult } from "./diff";

type Admin = SupabaseClient<Database>;
type IngestCompany = Pick<
  CompanyRow,
  "id" | "name" | "slug" | "ats_type" | "ats_slug" | "careers_url" | "tags"
>;

export interface IngestOutcome {
  company: string;
  adapter: string;
  status: RunStatus;
  diff?: DiffResult;
  error?: string;
  durationMs: number;
}

export async function ingestCompany(
  admin: Admin,
  company: IngestCompany,
  opts: { signal?: AbortSignal } = {},
): Promise<IngestOutcome> {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();

  let adapterLabel = company.ats_type;
  let slug = company.ats_slug ?? "";
  let adapter = getAdapter(company.ats_type);

  // Fall back to generic JSON-LD scraping of the careers page.
  if ((!adapter || adapter.type === "jsonld" || !slug) && company.careers_url) {
    adapter = jsonLdAdapter;
    slug = company.careers_url;
    adapterLabel = "jsonld";
  }

  const ctx = { ...DEFAULT_CONTEXT, signal: opts.signal };
  const finish = async (
    status: RunStatus,
    diff?: DiffResult,
    error?: string,
  ): Promise<IngestOutcome> => {
    const durationMs = Date.now() - t0;
    await admin.from("scrape_runs").insert({
      company_id: company.id,
      adapter: adapterLabel,
      status,
      jobs_found: diff?.found ?? 0,
      jobs_added: diff?.added ?? 0,
      jobs_closed: diff?.closed ?? 0,
      duration_ms: durationMs,
      error: error ?? null,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });
    await admin
      .from("companies")
      .update({
        last_scraped_at: new Date().toISOString(),
        last_scrape_status: status,
        status: status === "error" ? "error" : "active",
      })
      .eq("id", company.id);
    return {
      company: company.name,
      adapter: adapterLabel,
      status,
      diff,
      error,
      durationMs,
    };
  };

  if (!adapter || !slug) {
    return finish("error", undefined, "no adapter or slug/careers_url configured");
  }

  try {
    const raw = await adapter.fetchJobs(slug, ctx);
    const normalized = raw.map((r) => normalizeJob(r, adapter!.type === "jsonld" ? "jsonld" : "ats"));
    const diff = await applyDiff(admin, company.id, normalized);

    const friendly = isEarlyCareerFriendly(normalized);
    const tags = new Set(company.tags ?? []);
    if (friendly) tags.add("early-career");
    else tags.delete("early-career");
    await admin
      .from("companies")
      .update({ is_early_career_friendly: friendly, tags: [...tags] })
      .eq("id", company.id);

    const status: RunStatus = raw.length === 0 ? "partial" : "ok";
    return finish(status, diff);
  } catch (err) {
    return finish("error", undefined, err instanceof Error ? err.message : String(err));
  }
}

export { ADAPTERS };

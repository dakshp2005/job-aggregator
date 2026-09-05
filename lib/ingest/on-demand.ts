import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, CompanyRow, FetchStatus } from "@/lib/supabase/database.types";
import { resolveCompany } from "@/lib/ai/resolve-company";
import { ingestCompany } from "./run";
import { slugify } from "@/lib/utils";

type Admin = SupabaseClient<Database>;

async function setStatus(
  admin: Admin,
  id: string,
  status: FetchStatus,
  message: string,
  extra: Partial<{ error: string; resolved_company_id: string; completed_at: string }> = {},
) {
  await admin.from("fetch_requests").update({ status, message, ...extra }).eq("id", id);
}

async function findOrCreateCompany(
  admin: Admin,
  r: Awaited<ReturnType<typeof resolveCompany>>,
): Promise<CompanyRow> {
  const slug = slugify(r.name);

  // Match on slug first, then domain.
  const { data: bySlug } = await admin.from("companies").select("*").eq("slug", slug).maybeSingle();
  if (bySlug) return applyResolved(admin, bySlug, r);

  if (r.domain) {
    const { data: byDomain } = await admin
      .from("companies")
      .select("*")
      .eq("domain", r.domain)
      .maybeSingle();
    if (byDomain) return applyResolved(admin, byDomain, r);
  }

  const { data, error } = await admin
    .from("companies")
    .insert({
      name: r.name,
      slug,
      domain: r.domain,
      logo_url: r.domain ? `https://logo.clearbit.com/${r.domain}` : null,
      careers_url: r.careersUrl,
      ats_type: r.atsType,
      ats_slug: r.atsSlug,
      hq_country: r.hqCountry,
      description: r.description,
      status: "pending",
      source: "on-demand",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function applyResolved(
  admin: Admin,
  existing: CompanyRow,
  r: Awaited<ReturnType<typeof resolveCompany>>,
): Promise<CompanyRow> {
  // Only fill gaps — never clobber good data with a lower-confidence guess.
  // Exception: a company stuck in "error" never actually produced a job with
  // its current data, so it's safe (and necessary) to let a fresh resolution
  // fully replace it instead of only filling in blanks.
  const brokenExisting = existing.status === "error";
  const patch: Partial<CompanyRow> = {};
  if ((!existing.careers_url || brokenExisting) && r.careersUrl) patch.careers_url = r.careersUrl;
  if ((existing.ats_type === "unknown" || brokenExisting) && r.atsType !== "unknown") {
    patch.ats_type = r.atsType;
    patch.ats_slug = r.atsSlug;
  }
  if (!existing.domain && r.domain) patch.domain = r.domain;
  if (!existing.description && r.description) patch.description = r.description;
  if (Object.keys(patch).length === 0) return existing;
  const { data } = await admin
    .from("companies")
    .update(patch)
    .eq("id", existing.id)
    .select("*")
    .single();
  return data ?? existing;
}

export interface OnDemandResult {
  status: "done" | "failed";
  companyId?: string;
  slug?: string;
  jobs?: number;
  message: string;
}

/**
 * Full on-demand pipeline for a `fetch_requests` row: resolve the company,
 * persist it, scrape it (ATS → JSON-LD → AI extraction), and mark the request
 * done. Designed to run in `after()` or a GitHub Actions job.
 */
export async function processFetchRequest(
  admin: Admin,
  requestId: string,
): Promise<OnDemandResult> {
  const { data: req, error } = await admin
    .from("fetch_requests")
    .select("*")
    .eq("id", requestId)
    .single();
  if (error || !req) return { status: "failed", message: "request not found" };

  try {
    await setStatus(admin, requestId, "resolving", "Finding the company and its careers page…");
    const resolved = await resolveCompany(admin, req.raw_query);

    if (resolved.method === "unresolved" && !resolved.careersUrl) {
      await setStatus(
        admin,
        requestId,
        "failed",
        `Couldn't confidently identify "${req.raw_query}". Try the full legal company name or its website.`,
        { completed_at: new Date().toISOString() },
      );
      return { status: "failed", message: "unresolved" };
    }

    const company = await findOrCreateCompany(admin, resolved);

    await setStatus(
      admin,
      requestId,
      "scraping",
      `Reading openings from ${company.name}${resolved.atsType !== "unknown" ? ` (${resolved.atsType})` : ""}…`,
      { resolved_company_id: company.id },
    );

    // ingestCompany() runs the full ATS → JSON-LD → AI-extraction fallback
    // chain itself, so a brand-new company gets the same best-effort scrape
    // the recurring cron would give it.
    const outcome = await ingestCompany(admin, company, {
      onStatus: (label) =>
        setStatus(admin, requestId, label, "No structured feed — extracting with AI…", {
          resolved_company_id: company.id,
        }),
    });
    const jobCount = outcome.diff?.found ?? 0;

    await setStatus(
      admin,
      requestId,
      "done",
      jobCount > 0
        ? `Added ${company.name} with ${jobCount} open role${jobCount === 1 ? "" : "s"}.`
        : `Added ${company.name}. No open roles found right now — we'll keep checking.`,
      { resolved_company_id: company.id, completed_at: new Date().toISOString() },
    );

    return {
      status: "done",
      companyId: company.id,
      slug: company.slug,
      jobs: jobCount,
      message: "done",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setStatus(admin, requestId, "failed", "Something went wrong while fetching.", {
      error: message,
      completed_at: new Date().toISOString(),
    });
    return { status: "failed", message };
  }
}

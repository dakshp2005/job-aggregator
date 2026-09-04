import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CompanyRow, JobRow, PlatformStats } from "@/lib/supabase/database.types";

export async function getPlatformStats(): Promise<PlatformStats> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("platform_stats");
  return (
    (data as PlatformStats | null) ?? {
      companies: 0,
      open_jobs: 0,
      early_career_jobs: 0,
      last_updated: null,
    }
  );
}

export async function getCompanyBySlug(slug: string): Promise<CompanyRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return data ?? null;
}

export async function getCompanyJobs(
  companyId: string,
  { onlyOpen = true }: { onlyOpen?: boolean } = {},
): Promise<JobRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("jobs")
    .select("*")
    .eq("company_id", companyId)
    .order("is_early_career", { ascending: false })
    .order("posted_at", { ascending: false, nullsFirst: false });
  if (onlyOpen) q = q.eq("is_open", true);
  const { data } = await q;
  return data ?? [];
}

export interface CompanyFilters {
  tag?: string;
  country?: string;
  ats?: string;
  earlyCareer?: boolean;
  q?: string;
  page?: number;
  pageSize?: number;
}

export async function listCompanies(filters: CompanyFilters = {}) {
  const supabase = await createClient();
  const pageSize = filters.pageSize ?? 24;
  const page = Math.max(1, filters.page ?? 1);

  let q = supabase
    .from("companies")
    .select("*", { count: "exact" })
    .eq("status", "active");

  if (filters.tag) q = q.contains("tags", [filters.tag]);
  if (filters.earlyCareer) q = q.eq("is_early_career_friendly", true);
  if (filters.country) q = q.eq("hq_country", filters.country);
  if (filters.ats) q = q.eq("ats_type", filters.ats as CompanyRow["ats_type"]);
  if (filters.q) q = q.ilike("name", `%${filters.q}%`);

  q = q
    .order("open_jobs_count", { ascending: false })
    .order("name", { ascending: true })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const { data, count } = await q;
  return { companies: data ?? [], total: count ?? 0, page, pageSize };
}

export async function getTrendingCompanies(limit = 8): Promise<CompanyRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select("*")
    .eq("status", "active")
    .gt("open_jobs_count", 0)
    .order("open_jobs_count", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getRecentlyAdded(limit = 8): Promise<CompanyRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getEarlyCareerCompanies(limit = 8): Promise<CompanyRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select("*")
    .eq("status", "active")
    .eq("is_early_career_friendly", true)
    .order("open_jobs_count", { ascending: false })
    .limit(limit);
  return data ?? [];
}

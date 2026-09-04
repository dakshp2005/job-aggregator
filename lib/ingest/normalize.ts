import type { JobRow } from "@/lib/supabase/database.types";
import type { RawJob } from "@/lib/adapters/types";
import { snippet } from "@/lib/adapters/http";
import { classifyEarlyCareer } from "./early-career";

export type JobInsert = Omit<
  JobRow,
  "id" | "first_seen_at" | "last_seen_at" | "created_at" | "updated_at" | "is_open"
>;

const EMP_MAP: Record<string, string> = {
  fulltime: "full_time",
  "full-time": "full_time",
  "full time": "full_time",
  permanent: "full_time",
  regular: "full_time",
  parttime: "part_time",
  "part-time": "part_time",
  contract: "contract",
  contractor: "contract",
  temporary: "contract",
  intern: "intern",
  internship: "intern",
};

function normEmploymentType(raw?: string | null): string | null {
  if (!raw) return null;
  const k = raw.toLowerCase().trim();
  return EMP_MAP[k] ?? k.replace(/\s+/g, "_");
}

/** Drop parenthetical noise + trailing req IDs for cleaner search / dedupe. */
export function normalizeTitle(title: string): string {
  return title
    .replace(/\s*[\[(]\s*(req|requisition|job)?\s*#?\s*[\w-]+\s*[\])]\s*$/i, "")
    .replace(/\s*-\s*\d{4,}\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanLocations(raw: RawJob): { locations: string[]; location_raw: string | null; is_remote: boolean } {
  const set = new Set<string>();
  for (const l of [raw.location, ...(raw.locations ?? [])]) {
    if (!l) continue;
    l.split(/\s*(?:;|\||\bor\b|\/)\s*/i).forEach((part) => {
      const p = part.replace(/\s+/g, " ").trim();
      if (p && p.length < 120) set.add(p);
    });
  }
  const locations = [...set];
  const is_remote =
    Boolean(raw.remote) || locations.some((l) => /\b(remote|anywhere|distributed)\b/i.test(l));
  return {
    locations,
    location_raw: raw.location ?? locations.join(" · ") ?? null,
    is_remote,
  };
}

export function normalizeJob(raw: RawJob, source: string): JobInsert {
  const title = raw.title.trim();
  const { locations, location_raw, is_remote } = cleanLocations(raw);
  const descText = raw.descriptionText ?? "";
  const ec = classifyEarlyCareer(title, descText, raw.employmentType, raw.experienceLevel);

  let posted: string | null = null;
  if (raw.postedAt) {
    const d = new Date(raw.postedAt);
    if (!Number.isNaN(d.getTime()) && d.getFullYear() > 2000) posted = d.toISOString();
  }

  return {
    company_id: "", // filled by the caller
    source_uid: raw.sourceUid,
    title,
    normalized_title: normalizeTitle(title),
    department: raw.department?.trim() || null,
    team: raw.team?.trim() || null,
    location_raw,
    locations,
    is_remote,
    employment_type: normEmploymentType(raw.employmentType) ?? (ec.experienceLevel === "intern" ? "intern" : null),
    experience_level: ec.experienceLevel,
    is_early_career: ec.isEarlyCareer,
    apply_url: raw.url,
    description_snippet: descText ? snippet(descText) : null,
    description_html: raw.descriptionHtml ?? null,
    salary_min: raw.salaryMin ?? null,
    salary_max: raw.salaryMax ?? null,
    salary_currency: raw.salaryCurrency ?? null,
    posted_at: posted,
    confidence: raw.confidence ?? 1,
    source,
  };
}

/** Does this company have enough early-career roles to earn the tag? */
export function isEarlyCareerFriendly(jobs: JobInsert[]): boolean {
  const ec = jobs.filter((j) => j.is_early_career).length;
  return ec >= 1 && (ec / Math.max(jobs.length, 1) >= 0.15 || ec >= 3);
}

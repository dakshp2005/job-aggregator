import { fetchJson, htmlToText } from "./http";
import type { Adapter, AdapterContext, RawJob } from "./types";

interface AshbyJob {
  id: string;
  title: string;
  location?: string;
  secondaryLocations?: { location: string }[];
  department?: string;
  team?: string;
  employmentType?: string;
  isRemote?: boolean;
  publishedAt?: string;
  jobUrl?: string;
  applyUrl?: string;
  descriptionHtml?: string;
  descriptionPlain?: string;
  compensation?: {
    compensationTierSummary?: string;
    summaryComponents?: {
      compensationType?: string;
      minValue?: number;
      maxValue?: number;
      currencyCode?: string;
    }[];
  };
}

export const ashbyAdapter: Adapter = {
  type: "ashby",
  label: "Ashby",

  matchUrl(url: string) {
    try {
      const u = new URL(url);
      if (u.hostname === "jobs.ashbyhq.com") {
        return u.pathname.split("/").filter(Boolean)[0] ?? null;
      }
      return null;
    } catch {
      return null;
    }
  },

  async fetchJobs(slug: string, ctx: AdapterContext): Promise<RawJob[]> {
    const data = await fetchJson<{ jobs: AshbyJob[] }>(
      `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}?includeCompensation=true`,
      { ctx },
    );
    return (data.jobs ?? []).map((j) => {
      const salary = j.compensation?.summaryComponents?.find(
        (c) => c.compensationType === "Salary" || c.minValue || c.maxValue,
      );
      const locs = [
        j.location,
        ...(j.secondaryLocations ?? []).map((s) => s.location),
      ].filter(Boolean) as string[];
      return {
        sourceUid: j.id,
        title: j.title,
        url: j.jobUrl || j.applyUrl || "",
        location: j.location ?? null,
        locations: locs,
        remote: Boolean(j.isRemote) || /remote/i.test(j.location ?? ""),
        department: j.department ?? null,
        team: j.team ?? null,
        employmentType: j.employmentType ?? null,
        descriptionHtml: j.descriptionHtml ?? null,
        descriptionText: j.descriptionPlain || htmlToText(j.descriptionHtml),
        postedAt: j.publishedAt ?? null,
        salaryMin: salary?.minValue ?? null,
        salaryMax: salary?.maxValue ?? null,
        salaryCurrency: salary?.currencyCode ?? null,
        confidence: 1,
      } satisfies RawJob;
    });
  },
};

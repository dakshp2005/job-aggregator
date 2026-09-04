import { fetchJson, htmlToText } from "./http";
import type { Adapter, AdapterContext, RawJob } from "./types";

interface SrPosting {
  id: string;
  name: string;
  ref: string;
  releasedDate?: string;
  location?: { city?: string; region?: string; country?: string; remote?: boolean };
  department?: { label?: string };
  function?: { label?: string };
  typeOfEmployment?: { label?: string };
  experienceLevel?: { label?: string };
  company?: { identifier?: string; name?: string };
}

interface SrDetail {
  jobAd?: { sections?: { jobDescription?: { text?: string }; qualifications?: { text?: string } } };
}

const DETAIL_CAP = 25; // cap per-job detail fetches to stay polite / fast

export const smartRecruitersAdapter: Adapter = {
  type: "smartrecruiters",
  label: "SmartRecruiters",

  matchUrl(url: string) {
    try {
      const u = new URL(url);
      if (u.hostname === "jobs.smartrecruiters.com" || u.hostname === "careers.smartrecruiters.com") {
        return u.pathname.split("/").filter(Boolean)[0] ?? null;
      }
      return null;
    } catch {
      return null;
    }
  },

  async fetchJobs(slug: string, ctx: AdapterContext): Promise<RawJob[]> {
    const out: RawJob[] = [];
    let offset = 0;
    const limit = 100;
    for (let page = 0; page < 20; page++) {
      const data = await fetchJson<{ content: SrPosting[]; totalFound: number }>(
        `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(slug)}/postings?limit=${limit}&offset=${offset}`,
        { ctx },
      );
      const batch = data.content ?? [];
      for (const p of batch) {
        const loc = [p.location?.city, p.location?.region, p.location?.country]
          .filter(Boolean)
          .join(", ");
        let html: string | null = null;
        if (out.length < DETAIL_CAP) {
          try {
            const detail = await fetchJson<SrDetail>(
              `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(slug)}/postings/${p.id}`,
              { ctx },
            );
            const s = detail.jobAd?.sections;
            html = [s?.jobDescription?.text, s?.qualifications?.text].filter(Boolean).join("\n") || null;
          } catch {
            /* skip detail on error */
          }
        }
        out.push({
          sourceUid: p.id,
          title: p.name,
          url: `https://jobs.smartrecruiters.com/${slug}/${p.id}`,
          location: loc || null,
          locations: loc ? [loc] : [],
          remote: Boolean(p.location?.remote),
          department: p.department?.label ?? p.function?.label ?? null,
          employmentType: p.typeOfEmployment?.label ?? null,
          experienceLevel: p.experienceLevel?.label ?? null,
          descriptionHtml: html,
          descriptionText: htmlToText(html),
          postedAt: p.releasedDate ?? null,
          confidence: 1,
        });
      }
      offset += limit;
      if (batch.length < limit || offset >= (data.totalFound ?? 0)) break;
    }
    return out;
  },
};

import { fetchJson, htmlToText } from "./http";
import type { Adapter, AdapterContext, RawJob } from "./types";

interface RecruiteeOffer {
  id: number;
  title: string;
  slug: string;
  careers_url?: string;
  careers_apply_url?: string;
  location?: string;
  city?: string;
  country?: string;
  remote?: boolean;
  department?: string;
  employment_type_code?: string;
  published_at?: string;
  created_at?: string;
  description?: string;
  requirements?: string;
  min_hours?: number;
}

export const recruiteeAdapter: Adapter = {
  type: "recruitee",
  label: "Recruitee",

  matchUrl(url: string) {
    try {
      const u = new URL(url);
      if (u.hostname.endsWith(".recruitee.com")) {
        return u.hostname.replace(".recruitee.com", "");
      }
      return null;
    } catch {
      return null;
    }
  },

  async fetchJobs(slug: string, ctx: AdapterContext): Promise<RawJob[]> {
    const data = await fetchJson<{ offers: RecruiteeOffer[] }>(
      `https://${encodeURIComponent(slug)}.recruitee.com/api/offers/`,
      { ctx },
    );
    return (data.offers ?? []).map((o) => {
      const html = [o.description, o.requirements].filter(Boolean).join("\n") || null;
      const loc = o.location || [o.city, o.country].filter(Boolean).join(", ");
      return {
        sourceUid: String(o.id),
        title: o.title,
        url: o.careers_url || `https://${slug}.recruitee.com/o/${o.slug}`,
        location: loc || null,
        locations: loc ? [loc] : [],
        remote: Boolean(o.remote) || /remote/i.test(loc),
        department: o.department ?? null,
        employmentType: o.employment_type_code ?? null,
        descriptionHtml: html,
        descriptionText: htmlToText(html),
        postedAt: o.published_at || o.created_at || null,
        confidence: 1,
      } satisfies RawJob;
    });
  },
};

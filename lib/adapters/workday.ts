import { fetchJson, htmlToText, politeFetch } from "./http";
import type { Adapter, AdapterContext, RawJob } from "./types";

/**
 * Workday (experimental). The board slug we store is a composite:
 *   "<tenant>::<datacenter>::<site>"   e.g. "nvidia::wd5::NVIDIAExternalCareerSite"
 * derived from a careers URL like
 *   https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite
 */
const DETAIL_CAP = 30;
const PAGE_CAP = 10; // 10 * 20 = 200 postings max

function parseComposite(slug: string) {
  const [tenant, dc, site] = slug.split("::");
  return { tenant, dc, site };
}

export const workdayAdapter: Adapter = {
  type: "workday",
  label: "Workday",

  matchUrl(url: string) {
    try {
      const u = new URL(url);
      const m = u.hostname.match(/^([^.]+)\.(wd\d+)\.myworkdayjobs\.com$/);
      if (!m) return null;
      const parts = u.pathname.split("/").filter(Boolean);
      // strip a leading locale segment like "en-US"
      const site = parts[0] && /^[a-z]{2}-[A-Z]{2}$/.test(parts[0]) ? parts[1] : parts[0];
      if (!site) return null;
      return `${m[1]}::${m[2]}::${site}`;
    } catch {
      return null;
    }
  },

  async fetchJobs(slug: string, ctx: AdapterContext): Promise<RawJob[]> {
    const { tenant, dc, site } = parseComposite(slug);
    if (!tenant || !dc || !site) throw new Error(`bad workday slug: ${slug}`);
    const base = `https://${tenant}.${dc}.myworkdayjobs.com/wday/cxs/${tenant}/${site}`;
    const out: RawJob[] = [];

    for (let page = 0; page < PAGE_CAP; page++) {
      const res = await politeFetch(`${base}/jobs`, {
        ctx,
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: page * 20, searchText: "" }),
      });
      if (!res.ok) {
        if (page === 0) throw new Error(`workday ${res.status}`);
        break;
      }
      const data = (await res.json()) as {
        total?: number;
        jobPostings?: {
          title: string;
          externalPath: string;
          locationsText?: string;
          postedOn?: string;
          bulletFields?: string[];
        }[];
      };
      const postings = data.jobPostings ?? [];
      for (const p of postings) {
        const reqId = p.bulletFields?.[0] ?? p.externalPath;
        let html: string | null = null;
        let postedAt: string | null = null;
        if (out.length < DETAIL_CAP) {
          try {
            const detail = await fetchJson<{
              jobPostingInfo?: {
                jobDescription?: string;
                startDate?: string;
                externalUrl?: string;
              };
            }>(`${base}${p.externalPath}`, { ctx });
            html = detail.jobPostingInfo?.jobDescription ?? null;
            postedAt = detail.jobPostingInfo?.startDate ?? null;
          } catch {
            /* ignore */
          }
        }
        out.push({
          sourceUid: reqId,
          title: p.title,
          url: `https://${tenant}.${dc}.myworkdayjobs.com/en-US/${site}${p.externalPath}`,
          location: p.locationsText ?? null,
          locations: p.locationsText ? [p.locationsText] : [],
          remote: /remote/i.test(p.locationsText ?? ""),
          descriptionHtml: html,
          descriptionText: htmlToText(html),
          postedAt: postedAt ?? p.postedOn ?? null,
          confidence: 0.9,
        });
      }
      if (postings.length < 20 || out.length >= (data.total ?? 0)) break;
    }
    return out;
  },
};

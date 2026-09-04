import { fetchJson, htmlToText } from "./http";
import type { Adapter, AdapterContext, RawJob } from "./types";

interface GhJob {
  id: number;
  title: string;
  updated_at: string;
  absolute_url: string;
  location?: { name?: string };
  content?: string; // HTML-encoded
  departments?: { name: string }[];
  offices?: { name: string }[];
  metadata?: { name: string; value: any }[];
}

const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

export const greenhouseAdapter: Adapter = {
  type: "greenhouse",
  label: "Greenhouse",

  matchUrl(url: string) {
    try {
      const u = new URL(url);
      const h = u.hostname;
      if (h === "boards.greenhouse.io" || h === "job-boards.greenhouse.io" || h === "boards.eu.greenhouse.io") {
        return u.pathname.split("/").filter(Boolean)[0] ?? null;
      }
      if (h.endsWith(".greenhouse.io")) {
        const sub = h.replace(".greenhouse.io", "");
        if (sub && sub !== "boards" && sub !== "app") return sub;
      }
      const embed = u.searchParams.get("for");
      if (h.includes("greenhouse") && embed) return embed;
      return null;
    } catch {
      return null;
    }
  },

  async fetchJobs(slug: string, ctx: AdapterContext): Promise<RawJob[]> {
    const data = await fetchJson<{ jobs: GhJob[] }>(
      `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`,
      { ctx },
    );
    return (data.jobs ?? []).map((j) => {
      const html = j.content ? decode(j.content) : null;
      const dept = j.departments?.find((d) => d.name && d.name !== "No Department")?.name ?? null;
      const offices = (j.offices ?? []).map((o) => o.name).filter(Boolean);
      const loc = j.location?.name ?? offices[0] ?? null;
      return {
        sourceUid: String(j.id),
        title: j.title,
        url: j.absolute_url,
        location: loc,
        locations: offices.length ? offices : loc ? [loc] : [],
        remote: /remote/i.test(loc ?? ""),
        department: dept,
        descriptionHtml: html,
        descriptionText: htmlToText(html),
        postedAt: j.updated_at,
        confidence: 1,
      } satisfies RawJob;
    });
  },
};

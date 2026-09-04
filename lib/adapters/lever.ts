import { fetchJson, htmlToText } from "./http";
import type { Adapter, AdapterContext, RawJob } from "./types";

interface LeverPosting {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl: string;
  createdAt: number;
  categories?: {
    team?: string;
    department?: string;
    location?: string;
    commitment?: string;
    allLocations?: string[];
  };
  workplaceType?: string;
  descriptionPlain?: string;
  description?: string;
  lists?: { text: string; content: string }[];
}

export const leverAdapter: Adapter = {
  type: "lever",
  label: "Lever",

  matchUrl(url: string) {
    try {
      const u = new URL(url);
      if (u.hostname === "jobs.lever.co" || u.hostname === "jobs.eu.lever.co") {
        return u.pathname.split("/").filter(Boolean)[0] ?? null;
      }
      return null;
    } catch {
      return null;
    }
  },

  async fetchJobs(slug: string, ctx: AdapterContext): Promise<RawJob[]> {
    const data = await fetchJson<LeverPosting[]>(
      `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`,
      { ctx },
    );
    return (data ?? []).map((p) => {
      const cat = p.categories ?? {};
      const listHtml = (p.lists ?? [])
        .map((l) => `<h3>${l.text}</h3>${l.content}`)
        .join("");
      const html = [p.description, listHtml].filter(Boolean).join("\n");
      const locs = cat.allLocations?.length
        ? cat.allLocations
        : cat.location
          ? [cat.location]
          : [];
      return {
        sourceUid: p.id,
        title: p.text,
        url: p.hostedUrl || p.applyUrl,
        location: cat.location ?? null,
        locations: locs,
        remote:
          /remote/i.test(cat.location ?? "") ||
          (p.workplaceType ?? "").toLowerCase() === "remote",
        department: cat.department ?? null,
        team: cat.team ?? null,
        employmentType: cat.commitment ?? null,
        descriptionHtml: html || null,
        descriptionText: p.descriptionPlain || htmlToText(html),
        postedAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
        confidence: 1,
      } satisfies RawJob;
    });
  },
};

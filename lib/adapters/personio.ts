import * as cheerio from "cheerio";
import { fetchText, htmlToText } from "./http";
import type { Adapter, AdapterContext, RawJob } from "./types";

/** Personio exposes an XML feed at https://<slug>.jobs.personio.de/xml */
export const personioAdapter: Adapter = {
  type: "personio",
  label: "Personio",

  matchUrl(url: string) {
    try {
      const u = new URL(url);
      const m = u.hostname.match(/^([^.]+)\.jobs\.personio\.(de|com)$/);
      return m ? m[1] : null;
    } catch {
      return null;
    }
  },

  async fetchJobs(slug: string, ctx: AdapterContext): Promise<RawJob[]> {
    const xml = await fetchText(`https://${encodeURIComponent(slug)}.jobs.personio.de/xml`, {
      ctx,
    });
    const $ = cheerio.load(xml, { xml: true });
    const jobs: RawJob[] = [];
    $("position").each((_, el) => {
      const $el = $(el);
      const id = $el.find("id").first().text().trim();
      const title = $el.find("name").first().text().trim();
      if (!id || !title) return;
      const office = $el.find("office").first().text().trim();
      const dept = $el.find("department").first().text().trim();
      const schedule = $el.find("schedule").first().text().trim();
      const seniority = $el.find("seniority").first().text().trim();
      const descParts: string[] = [];
      $el.find("jobDescriptions > jobDescription").each((__, d) => {
        descParts.push($(d).find("name").text() + ": " + $(d).find("value").text());
      });
      const html = descParts.join("\n") || $el.find("description").text() || null;
      jobs.push({
        sourceUid: id,
        title,
        url: `https://${slug}.jobs.personio.de/job/${id}`,
        location: office || null,
        locations: office ? [office] : [],
        remote: /remote/i.test(office),
        department: dept || null,
        employmentType: schedule || null,
        experienceLevel: seniority || null,
        descriptionHtml: html,
        descriptionText: htmlToText(html),
        postedAt: $el.find("createdAt").first().text().trim() || null,
        confidence: 1,
      });
    });
    return jobs;
  },
};

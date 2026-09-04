import * as cheerio from "cheerio";
import { fetchText, htmlToText } from "./http";
import type { Adapter, AdapterContext, RawJob } from "./types";
import { slugify } from "@/lib/utils";

const LINK_CRAWL_CAP = 15;

interface LdJobPosting {
  "@type"?: string | string[];
  title?: string;
  name?: string;
  datePosted?: string;
  validThrough?: string;
  employmentType?: string | string[];
  description?: string;
  url?: string;
  identifier?: any;
  jobLocation?: any;
  applicantLocationRequirements?: any;
  jobLocationType?: string;
  baseSalary?: any;
  hiringOrganization?: any;
}

function typeIncludes(t: string | string[] | undefined, want: string) {
  if (!t) return false;
  return Array.isArray(t) ? t.includes(want) : t === want;
}

function collectPostings(node: any, acc: LdJobPosting[]) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach((n) => collectPostings(n, acc));
    return;
  }
  if (typeIncludes(node["@type"], "JobPosting")) acc.push(node);
  if (node["@graph"]) collectPostings(node["@graph"], acc);
  if (node.itemListElement) collectPostings(node.itemListElement, acc);
  if (node.item) collectPostings(node.item, acc);
}

function extractLocations(jp: LdJobPosting): { locations: string[]; remote: boolean } {
  const locs: string[] = [];
  const walk = (n: any) => {
    if (!n) return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (typeof n !== "object") return;
    const addr = n.address ?? n;
    const parts = [addr.addressLocality, addr.addressRegion, addr.addressCountry]
      .map((p: any) => (typeof p === "object" ? p?.name : p))
      .filter(Boolean);
    if (parts.length) locs.push(parts.join(", "));
  };
  walk(jp.jobLocation);
  const remote =
    jp.jobLocationType === "TELECOMMUTE" ||
    Boolean(jp.applicantLocationRequirements) ||
    locs.some((l) => /remote/i.test(l));
  return { locations: [...new Set(locs)], remote };
}

function extractSalary(jp: LdJobPosting) {
  const b = jp.baseSalary;
  if (!b || typeof b !== "object") return {};
  const v = b.value ?? b;
  const currency = b.currency ?? v.currency ?? null;
  const min = Number(v.minValue ?? v.value ?? NaN);
  const max = Number(v.maxValue ?? v.value ?? NaN);
  return {
    salaryMin: Number.isFinite(min) ? min : null,
    salaryMax: Number.isFinite(max) ? max : null,
    salaryCurrency: currency,
  };
}

function parsePage(html: string, pageUrl: string): RawJob[] {
  const $ = cheerio.load(html);
  const found: LdJobPosting[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const txt = $(el).contents().text();
    if (!txt) return;
    try {
      collectPostings(JSON.parse(txt), found);
    } catch {
      /* malformed block, ignore */
    }
  });
  return found.map((jp) => {
    const title = jp.title || jp.name || "Untitled role";
    const { locations, remote } = extractLocations(jp);
    const idRaw =
      typeof jp.identifier === "object"
        ? jp.identifier?.value ?? jp.identifier?.name
        : jp.identifier;
    return {
      sourceUid: String(idRaw || jp.url || `${slugify(title)}-${locations[0] ?? ""}`),
      title,
      url: jp.url || pageUrl,
      location: locations[0] ?? null,
      locations,
      remote,
      employmentType: Array.isArray(jp.employmentType)
        ? jp.employmentType[0]
        : jp.employmentType ?? null,
      descriptionHtml: jp.description ?? null,
      descriptionText: htmlToText(jp.description),
      postedAt: jp.datePosted ?? null,
      ...extractSalary(jp),
      confidence: 0.8,
    } satisfies RawJob;
  });
}

export const jsonLdAdapter: Adapter = {
  type: "jsonld",
  label: "Careers page (JSON-LD)",

  matchUrl() {
    return null; // never auto-detected; used as an explicit fallback
  },

  async fetchJobs(careersUrl: string, ctx: AdapterContext): Promise<RawJob[]> {
    const root = await fetchText(careersUrl, { ctx });
    const byUid = new Map<string, RawJob>();
    for (const j of parsePage(root, careersUrl)) byUid.set(j.sourceUid, j);

    // If the listing page had no embedded postings, crawl a few likely job links.
    if (byUid.size === 0) {
      const $ = cheerio.load(root);
      const origin = new URL(careersUrl).origin;
      const links = new Set<string>();
      $("a[href]").each((_, el) => {
        const href = $(el).attr("href");
        if (!href) return;
        let abs: string;
        try {
          abs = new URL(href, careersUrl).toString();
        } catch {
          return;
        }
        if (!abs.startsWith(origin)) return;
        if (/\/(jobs?|careers?|positions?|openings?|vacanc)/i.test(abs) && !/#/.test(abs)) {
          links.add(abs.split("?")[0]);
        }
      });
      let n = 0;
      for (const link of links) {
        if (n++ >= LINK_CRAWL_CAP) break;
        try {
          const page = await fetchText(link, { ctx });
          for (const j of parsePage(page, link)) byUid.set(j.sourceUid, j);
        } catch {
          /* ignore individual link failures */
        }
      }
    }
    return [...byUid.values()];
  },
};

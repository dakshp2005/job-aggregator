import * as cheerio from "cheerio";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, AtsType } from "@/lib/supabase/database.types";
import { detectAts, ADAPTERS } from "@/lib/adapters/registry";
import { politeFetch, DEFAULT_CONTEXT } from "@/lib/adapters/http";
import { geminiJson } from "./gemini";
import { slugify } from "@/lib/utils";

type Admin = SupabaseClient<Database>;

export interface ResolvedCompany {
  name: string;
  domain: string | null;
  careersUrl: string | null;
  atsType: AtsType;
  atsSlug: string | null;
  description: string | null;
  hqCountry: string | null;
  method: "probe" | "html-link" | "ai" | "unresolved";
  confidence: number;
}

const TLDS = [".com", ".io", ".ai", ".co", ".org", ".dev", ".xyz"];
const CAREERS_PATHS = ["/careers", "/careers/", "/jobs", "/careers/jobs", "/about/careers", "/company/careers", "/join-us", "/work-with-us"];

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function slugVariants(query: string): string[] {
  const base = slugify(query);
  const noDash = base.replace(/-/g, "");
  const noSuffix = base.replace(/-(inc|llc|ltd|labs|technologies|tech|group|corp|co)$/i, "");
  return [...new Set([base, noDash, noSuffix, noSuffix.replace(/-/g, "")])].filter(Boolean);
}

async function probe(url: string): Promise<{ ok: boolean; finalUrl: string; html?: string }> {
  try {
    const res = await politeFetch(url, { ctx: DEFAULT_CONTEXT, retries: 0, timeoutMs: 12_000 });
    if (!res.ok) return { ok: false, finalUrl: res.url || url };
    const ct = res.headers.get("content-type") ?? "";
    const html = ct.includes("html") || ct.includes("xml") ? await res.text() : undefined;
    return { ok: true, finalUrl: res.url || url, html };
  } catch {
    return { ok: false, finalUrl: url };
  }
}

/** Scan a page's HTML for outbound links to a known ATS host. */
function findAtsInHtml(html: string): { atsType: AtsType; atsSlug: string } | null {
  const $ = cheerio.load(html);
  const urls = new Set<string>();
  $("a[href], iframe[src], link[href]").each((_, el) => {
    const v = $(el).attr("href") || $(el).attr("src");
    if (v && /greenhouse|lever\.co|ashbyhq|smartrecruiters|recruitee|personio|myworkdayjobs/i.test(v)) {
      urls.add(v);
    }
  });
  for (const m of html.matchAll(
    /https?:\/\/[^\s"'<>]*(?:greenhouse\.io|lever\.co|ashbyhq\.com|smartrecruiters\.com|recruitee\.com|jobs\.personio\.[a-z]+|myworkdayjobs\.com)[^\s"'<>]*/gi,
  )) {
    urls.add(m[0]);
  }
  for (const u of urls) {
    const hit = detectAts(u.replace(/&amp;/g, "&"));
    if (hit) return hit;
  }
  return null;
}

async function findCareersLink(homepageHtml: string, origin: string): Promise<string | null> {
  const $ = cheerio.load(homepageHtml);
  let best: string | null = null;
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    const text = ($(el).text() || "").toLowerCase();
    if (!href) return;
    const looksLikeCareers =
      /career|jobs|join|hiring|work with us|we.?re hiring/i.test(text) ||
      /\/(careers?|jobs)(\/|$|\?)/i.test(href);
    if (looksLikeCareers) {
      try {
        if (!best) best = new URL(href, origin).toString();
      } catch {
        /* ignore */
      }
    }
  });
  return best;
}

/**
 * Best-effort: turn a free-text company name into a domain + ATS + careers URL.
 * Tries cheap HTTP probes first; only calls Gemini when probing is inconclusive.
 */
export async function resolveCompany(admin: Admin, query: string): Promise<ResolvedCompany> {
  const name = titleCase(query.trim());
  const variants = slugVariants(query);

  const base: ResolvedCompany = {
    name,
    domain: null,
    careersUrl: null,
    atsType: "unknown",
    atsSlug: null,
    description: null,
    hqCountry: null,
    method: "unresolved",
    confidence: 0,
  };

  // 1) Direct ATS guesses — cheapest possible hit.
  for (const v of variants) {
    for (const adapter of ADAPTERS) {
      if (adapter.type === "jsonld") continue;
      const guessUrls: Record<string, string[]> = {
        greenhouse: [`https://boards.greenhouse.io/${v}`, `https://job-boards.greenhouse.io/${v}`],
        lever: [`https://jobs.lever.co/${v}`],
        ashby: [`https://jobs.ashbyhq.com/${v}`],
        smartrecruiters: [`https://jobs.smartrecruiters.com/${v}`],
        recruitee: [`https://${v}.recruitee.com/`],
        personio: [`https://${v}.jobs.personio.de/`],
        workday: [],
      };
      for (const g of guessUrls[adapter.type] ?? []) {
        const r = await probe(g);
        if (r.ok) {
          const hit = detectAts(r.finalUrl) ?? { atsType: adapter.type, atsSlug: v };
          return {
            ...base,
            careersUrl: r.finalUrl,
            atsType: hit.atsType,
            atsSlug: hit.atsSlug,
            method: "probe",
            confidence: 0.75,
          };
        }
      }
    }
  }

  // 2) Find the real domain, then its careers page, then any ATS it links to.
  let domain: string | null = null;
  let homepageHtml: string | undefined;
  for (const v of variants) {
    for (const tld of TLDS) {
      const cand = `${v.replace(/-/g, "")}${tld}`;
      const r = await probe(`https://${cand}`);
      if (r.ok) {
        domain = cand;
        homepageHtml = r.html;
        break;
      }
    }
    if (domain) break;
  }

  if (domain) {
    base.domain = domain;
    const origin = `https://${domain}`;
    const careerCandidates: string[] = [];
    if (homepageHtml) {
      const linked = await findCareersLink(homepageHtml, origin);
      if (linked) careerCandidates.push(linked);
      const embedded = findAtsInHtml(homepageHtml);
      if (embedded) {
        return { ...base, careersUrl: origin, ...embedded, method: "html-link", confidence: 0.7 };
      }
    }
    careerCandidates.push(...CAREERS_PATHS.map((p) => origin + p));

    for (const url of [...new Set(careerCandidates)]) {
      const r = await probe(url);
      if (!r.ok) continue;
      base.careersUrl = r.finalUrl;
      const direct = detectAts(r.finalUrl);
      if (direct) return { ...base, ...direct, method: "probe", confidence: 0.8 };
      if (r.html) {
        const hit = findAtsInHtml(r.html);
        if (hit) return { ...base, ...hit, method: "html-link", confidence: 0.7 };
        // keep the careers URL for JSON-LD fallback even without an ATS
        base.atsType = "jsonld";
      }
      break;
    }
  }

  // 3) Ask Gemini to disambiguate from whatever HTML we gathered.
  try {
    const context = [
      homepageHtml ? `HOMEPAGE (${domain}):\n${cheerioText(homepageHtml)}` : "",
      base.careersUrl ? `CAREERS PAGE (${base.careersUrl})` : "",
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 12_000);

    const ai = await geminiJson<{
      companyName: string;
      domain: string | null;
      careersUrl: string | null;
      atsType: string | null;
      atsSlug: string | null;
      description: string | null;
      hqCountry: string | null;
    }>(
      `Identify the employer for the search term "${query}". Use the context if useful.\n\n${context}\n\n` +
        `Return the official company name, primary domain, the URL of its job listings page, ` +
        `which applicant tracking system it uses (one of: greenhouse, lever, ashby, smartrecruiters, ` +
        `recruitee, personio, workday, or "unknown"), the ATS board slug if identifiable, a one-sentence ` +
        `description, and HQ country (ISO name).`,
      {
        admin,
        systemInstruction:
          "You are a precise company-data resolver. Never invent domains or slugs; use null when unsure.",
        responseSchema: {
          type: "object",
          properties: {
            companyName: { type: "string" },
            domain: { type: "string", nullable: true },
            careersUrl: { type: "string", nullable: true },
            atsType: { type: "string", nullable: true },
            atsSlug: { type: "string", nullable: true },
            description: { type: "string", nullable: true },
            hqCountry: { type: "string", nullable: true },
          },
          required: ["companyName"],
        },
      },
    );

    const atsType = normalizeAtsType(ai.atsType);
    const careersUrl = ai.careersUrl || base.careersUrl;
    const atsSlug = ai.atsSlug || base.atsSlug;
    if (careersUrl) {
      const hit = detectAts(careersUrl);
      if (hit) return { ...base, name: ai.companyName || name, domain: ai.domain || base.domain, description: ai.description, hqCountry: ai.hqCountry, careersUrl, atsType: hit.atsType, atsSlug: hit.atsSlug, method: "ai", confidence: 0.6 };
    }
    return {
      ...base,
      name: ai.companyName || name,
      domain: ai.domain || base.domain,
      description: ai.description,
      hqCountry: ai.hqCountry,
      careersUrl,
      atsType: atsType !== "unknown" ? atsType : base.careersUrl ? "jsonld" : "unknown",
      atsSlug,
      method: "ai",
      confidence: careersUrl ? 0.5 : 0.2,
    };
  } catch {
    // Gemini unavailable / over budget — return whatever probing found.
    if (base.careersUrl) {
      return { ...base, atsType: base.atsType === "unknown" ? "jsonld" : base.atsType, method: "probe", confidence: 0.4 };
    }
    return base;
  }
}

function cheerioText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg").remove();
  return $("body").text().replace(/\s+/g, " ").trim().slice(0, 6000);
}

function normalizeAtsType(v: string | null | undefined): AtsType {
  const k = (v ?? "").toLowerCase().trim();
  const known: AtsType[] = [
    "greenhouse",
    "lever",
    "ashby",
    "smartrecruiters",
    "recruitee",
    "personio",
    "workday",
    "jsonld",
  ];
  return (known.find((t) => k.includes(t)) as AtsType) ?? "unknown";
}

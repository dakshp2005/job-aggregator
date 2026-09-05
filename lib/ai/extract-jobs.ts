import * as cheerio from "cheerio";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { RawJob } from "@/lib/adapters/types";
import { fetchText, DEFAULT_CONTEXT } from "@/lib/adapters/http";
import { geminiJson } from "./gemini";
import { renderPageText } from "./browser-render";
import { slugify } from "@/lib/utils";

type Admin = SupabaseClient<Database>;

interface AiJob {
  title: string;
  applyUrl?: string | null;
  location?: string | null;
  remote?: boolean | null;
  department?: string | null;
  employmentType?: string | null;
  postedAt?: string | null;
}

const SCHEMA = {
  type: "object",
  properties: {
    jobs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          applyUrl: { type: "string", nullable: true },
          location: { type: "string", nullable: true },
          remote: { type: "boolean", nullable: true },
          department: { type: "string", nullable: true },
          employmentType: { type: "string", nullable: true },
          postedAt: { type: "string", nullable: true },
        },
        required: ["title"],
      },
    },
  },
  required: ["jobs"],
};

async function pageText(url: string): Promise<string | null> {
  // Prefer a real headless-browser render (sees JS-loaded job widgets a
  // plain fetch never executes); fall back to a plain fetch when rendering
  // isn't available/enabled or came back too thin to be useful.
  let text = await renderPageText(url);
  if (text && text.length >= 200) return text;

  try {
    const html = await fetchText(url, { ctx: DEFAULT_CONTEXT });
    const $ = cheerio.load(html);
    $("script, style, noscript, svg, header, footer, nav").remove();

    // Keep anchor hrefs inline so the model can attach real apply URLs.
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (href) $(el).text(`${$(el).text()} <<${href}>>`);
    });
    text = $("body").text().replace(/\s+/g, " ").trim().slice(0, 18_000);
  } catch {
    // keep whatever renderPageText produced, if anything
  }
  return text && text.length >= 200 ? text : null;
}

// A "/careers" landing page frequently just links out to the real listings
// page (e.g. "/current-openings", "/open-positions") rather than showing
// jobs itself. Look for that link among the inlined "<<url>>" tokens.
const OPENINGS_LINK_RE =
  /<<(https?:\/\/[^\s>]*(?:current-openings|open-positions|open-roles|job-openings|openings|vacancies|positions)[^\s>]*)>>/i;

function findOpeningsLink(text: string, currentUrl: string): string | null {
  const m = text.match(OPENINGS_LINK_RE);
  if (!m) return null;
  try {
    const url = new URL(m[1], currentUrl).toString();
    return url === currentUrl ? null : url;
  } catch {
    return null;
  }
}

async function extractFromText(text: string, pageUrl: string, admin: Admin): Promise<AiJob[]> {
  const result = await geminiJson<{ jobs: AiJob[] }>(
    `Extract every distinct job opening from this careers page text. Inline tokens like ` +
      `"<<https://...>>" are the link targets for the preceding text. Ignore navigation, ` +
      `perks, and boilerplate.\n\nPAGE: ${pageUrl}\n\n${text}`,
    {
      admin,
      systemInstruction:
        "You extract job postings verbatim. Do not invent roles. If the page shows no openings, return an empty array.",
      responseSchema: SCHEMA,
      maxOutputTokens: 8192,
    },
  );
  return result.jobs ?? [];
}

/**
 * Last-resort extraction: read a bespoke careers page and pull structured
 * postings out of it with Gemini. Only reached when both ATS adapters and
 * JSON-LD parsing came up empty.
 */
export async function extractJobsWithAi(
  admin: Admin,
  careersUrl: string,
): Promise<RawJob[]> {
  let pageUrl = careersUrl;
  const text = await pageText(pageUrl);
  if (!text) return [];

  let jobs = await extractFromText(text, pageUrl, admin);

  // The landing page had no listings of its own — follow an obvious
  // "current openings" style link once and try again there.
  if (jobs.length === 0) {
    const openingsUrl = findOpeningsLink(text, pageUrl);
    if (openingsUrl) {
      const openingsText = await pageText(openingsUrl);
      if (openingsText) {
        const openingsJobs = await extractFromText(openingsText, openingsUrl, admin);
        if (openingsJobs.length > 0) {
          jobs = openingsJobs;
          pageUrl = openingsUrl;
        }
      }
    }
  }

  const origin = new URL(careersUrl).origin;
  return jobs
    .filter((j) => j.title && j.title.length < 200)
    .map((j) => {
      let url = j.applyUrl || pageUrl;
      try {
        url = new URL(url, origin).toString();
      } catch {
        url = pageUrl;
      }
      return {
        sourceUid: `ai-${slugify(j.title)}-${slugify(j.location ?? "")}`.slice(0, 120),
        title: j.title.trim(),
        url,
        location: j.location ?? null,
        locations: j.location ? [j.location] : [],
        remote: Boolean(j.remote) || /remote/i.test(j.location ?? ""),
        department: j.department ?? null,
        employmentType: j.employmentType ?? null,
        postedAt: j.postedAt ?? null,
        confidence: 0.5,
      } satisfies RawJob;
    });
}

import * as cheerio from "cheerio";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { RawJob } from "@/lib/adapters/types";
import { fetchText, DEFAULT_CONTEXT } from "@/lib/adapters/http";
import { geminiJson } from "./gemini";
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

/**
 * Last-resort extraction: read a bespoke careers page and pull structured
 * postings out of it with Gemini. Only reached when both ATS adapters and
 * JSON-LD parsing came up empty.
 */
export async function extractJobsWithAi(
  admin: Admin,
  careersUrl: string,
): Promise<RawJob[]> {
  let html: string;
  try {
    html = await fetchText(careersUrl, { ctx: DEFAULT_CONTEXT });
  } catch {
    return [];
  }

  const $ = cheerio.load(html);
  $("script, style, noscript, svg, header, footer, nav").remove();

  // Keep anchor hrefs inline so the model can attach real apply URLs.
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (href) $(el).text(`${$(el).text()} <<${href}>>`);
  });
  const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, 18_000);
  if (text.length < 200) return [];

  const origin = new URL(careersUrl).origin;
  const result = await geminiJson<{ jobs: AiJob[] }>(
    `Extract every distinct job opening from this careers page text. Inline tokens like ` +
      `"<<https://...>>" are the link targets for the preceding text. Ignore navigation, ` +
      `perks, and boilerplate.\n\nPAGE: ${careersUrl}\n\n${text}`,
    {
      admin,
      systemInstruction:
        "You extract job postings verbatim. Do not invent roles. If the page shows no openings, return an empty array.",
      responseSchema: SCHEMA,
      maxOutputTokens: 8192,
    },
  );

  return (result.jobs ?? [])
    .filter((j) => j.title && j.title.length < 200)
    .map((j) => {
      let url = j.applyUrl || careersUrl;
      try {
        url = new URL(url, origin).toString();
      } catch {
        url = careersUrl;
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

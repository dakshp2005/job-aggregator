import * as cheerio from "cheerio";
import { politeFetch, DEFAULT_CONTEXT } from "@/lib/adapters/http";

// DuckDuckGo's html endpoint challenges the app's identifying bot UA, so this
// one call impersonates an ordinary browser instead.
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const AGGREGATOR_HOSTS = [
  "linkedin.com",
  "indeed.com",
  "naukri.com",
  "glassdoor.com",
  "monsterindia.com",
  "monster.com",
  "shine.com",
  "wellfound.com",
  "ambitionbox.com",
  "ziprecruiter.com",
  "simplyhired.com",
  "timesjobs.com",
  "foundit.in",
  "instahyre.com",
  "cutshort.io",
  "crunchbase.com",
  "wikipedia.org",
  "facebook.com",
  "twitter.com",
  "x.com",
  "instagram.com",
  "youtube.com",
];

export interface SearchHit {
  url: string;
  title: string;
}

/** Free, no-key web search via DuckDuckGo's HTML results page. */
export async function webSearch(query: string, limit = 8): Promise<SearchHit[]> {
  let res;
  try {
    res = await politeFetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      ctx: DEFAULT_CONTEXT,
      retries: 1,
      timeoutMs: 12_000,
      headers: { "user-agent": BROWSER_UA, accept: "text/html" },
    });
  } catch {
    return [];
  }
  if (!res.ok) return [];

  const html = await res.text();
  const $ = cheerio.load(html);
  const hits: SearchHit[] = [];
  $("a.result__a").each((_, el) => {
    const href = $(el).attr("href") || "";
    const m = href.match(/[?&]uddg=([^&]+)/);
    const url = m ? decodeURIComponent(m[1]) : href;
    if (/^https?:\/\//i.test(url)) hits.push({ url, title: $(el).text().trim() });
  });
  return hits.slice(0, limit);
}

export function isAggregatorHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return AGGREGATOR_HOSTS.some((a) => h === a || h.endsWith(`.${a}`));
}

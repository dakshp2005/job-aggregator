import { AdapterError, type AdapterContext } from "./types";

export const DEFAULT_CONTEXT: AdapterContext = {
  contactUrl:
    process.env.SCRAPER_CONTACT_URL ||
    "https://github.com/your-github-username/job-platform",
  minDelayMs: 1100,
};

function userAgent(ctx: AdapterContext) {
  return `OpenRolesBot/1.0 (+${ctx.contactUrl})`;
}

const lastHit = new Map<string, number>();

/** Politeness: ensure at least `minDelayMs` between requests to the same host. */
async function throttle(url: string, ctx: AdapterContext) {
  const host = new URL(url).host;
  const prev = lastHit.get(host) ?? 0;
  const wait = prev + ctx.minDelayMs - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastHit.set(host, Date.now());
}

interface FetchOpts extends RequestInit {
  ctx?: AdapterContext;
  timeoutMs?: number;
  retries?: number;
}

export async function politeFetch(url: string, opts: FetchOpts = {}): Promise<Response> {
  const ctx = opts.ctx ?? DEFAULT_CONTEXT;
  const { timeoutMs = 20_000, retries = 2, ...init } = opts;
  await throttle(url, ctx);

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...init,
        signal: ctx.signal ?? ac.signal,
        headers: {
          "user-agent": userAgent(ctx),
          accept: "application/json, text/html;q=0.9, */*;q=0.8",
          ...init.headers,
        },
      });
      clearTimeout(t);
      if (res.status === 429 || res.status >= 500) {
        lastErr = new AdapterError(`upstream ${res.status}`, res.status);
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1) ** 2));
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(t);
      lastErr = err;
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new AdapterError(String(lastErr));
}

export async function fetchJson<T = any>(url: string, opts: FetchOpts = {}): Promise<T> {
  const res = await politeFetch(url, opts);
  if (!res.ok) throw new AdapterError(`GET ${url} -> ${res.status}`, res.status);
  return (await res.json()) as T;
}

export async function fetchText(url: string, opts: FetchOpts = {}): Promise<string> {
  const res = await politeFetch(url, opts);
  if (!res.ok) throw new AdapterError(`GET ${url} -> ${res.status}`, res.status);
  return res.text();
}

/** Strip HTML to a plain-text snippet. */
export function htmlToText(html: string | null | undefined, max = 4000): string {
  if (!html) return "";
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

export function snippet(text: string, len = 280): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > len ? clean.slice(0, len - 1).trimEnd() + "…" : clean;
}

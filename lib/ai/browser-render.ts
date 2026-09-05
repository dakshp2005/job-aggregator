import { DEFAULT_CONTEXT, userAgent } from "@/lib/adapters/http";

/**
 * Renders a page with a real headless browser so client-side-loaded content
 * (React/Vue job widgets, AJAX-fetched listings) actually appears, unlike a
 * plain fetch() which only ever sees the server's first response.
 *
 * Only runs when ENABLE_BROWSER_RENDER=true (set in the GitHub Actions
 * ingestion workflows, where Chromium is installed) — everywhere else
 * (local dev without a browser installed, the Vercel-serverless inline
 * fallback) this is a safe, cheap no-op.
 */
export async function renderPageText(url: string): Promise<string | null> {
  if (process.env.ENABLE_BROWSER_RENDER !== "true") return null;

  let browser: import("playwright").Browser | undefined;
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ userAgent: userAgent(DEFAULT_CONTEXT) });
    await page.goto(url, { waitUntil: "networkidle", timeout: 15_000 });

    // Inline anchor hrefs as "<<url>>" tokens (same convention extract-jobs.ts
    // uses) so apply links survive the trip through plain text into Gemini.
    const text = await page.evaluate(() => {
      document.querySelectorAll("script, style, noscript, svg, header, footer, nav").forEach((el) => el.remove());
      document.querySelectorAll("a[href]").forEach((el) => {
        const href = el.getAttribute("href");
        if (href) el.textContent = `${el.textContent ?? ""} <<${href}>>`;
      });
      return document.body?.innerText ?? "";
    });

    return text.replace(/\s+/g, " ").trim().slice(0, 18_000);
  } catch {
    return null;
  } finally {
    await browser?.close().catch(() => {});
  }
}

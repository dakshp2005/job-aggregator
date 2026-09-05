# Session Log — OpenRoles build

Handoff document for another developer or AI picking this up. Written 2026‑09‑04,
updated 2026‑09‑06 (see §7 for what changed).

---

## 1. How this came about (conversation history)

The user had an idea: **"a platform where you can see all available/upcoming jobs and
interview openings from company name to application form link, all in one place. User searches
a company; if there are postings, they can apply directly from there."** They asked for
open-ended thoughts first, not a plan.

Discussion that shaped the product:

1. **Positioning.** The job-board space is crowded (Indeed, LinkedIn, Google Jobs, etc.).
   The defensible angle is **company-centric** discovery (pick a company → see everything it
   has open) rather than role-centric search, plus a **self-growing dataset** and an
   integrated **application tracker** for retention.
2. **"Apply directly"** — auto-submitting into company ATSes is not realistically possible at
   $0 and usually violates their terms. Decision: **deep-link to the real application form**,
   plus a **"copy my profile"** helper (stored résumé + fields) so forms fill fast.
3. **Data acquisition.** Considered: official ATS APIs, hidden JSON endpoints, schema.org
   JSON-LD, sitemaps/RSS, commercial feeds, crowd contribution, Common Crawl, and
   "AI browses the careers page". Landed on a **layered cascade**:
   ATS adapter → JSON-LD scrape → sitemap diff (future) → **Gemini extraction** as the last
   resort. AI browsing is the fallback for the long tail, not the primary path (cost/latency).
4. **On-demand fetch.** When a searched company isn't indexed, an AI agent resolves it, finds
   its careers page, scrapes it, and adds it **permanently**. Must be an async
   "we'll go get it" flow with visible progress + a correctable company-resolution step —
   never a blocking 30-second search call.

Then the user asked for a **full implementation**, with these hard constraints:

- **$0 running cost** — permanent free tiers only. User is not investing.
- **UI with shadcn.**
- Work inside the `job-platform/` folder only; do not scan the rest of `Downloads`.
- **Database: Supabase.** Deliver migration files; the user runs them. User adds the
  Supabase URL / anon key / service-role key to the env file themselves.
- **One final version** — build everything now: discovery + accounts + watchlist/alerts +
  application tracker. No phased "v1".
- Seed **both** general/global tech **and** new-grad/early-career company sets.
- Code repo will be **public** on GitHub (enables unlimited GitHub Actions minutes).
- Add a `.gitignore` inside the folder.

---

## 2. Architecture as built (all free tier)

| Concern | Choice |
|---|---|
| App + API | Next.js 15 App Router on Vercel Hobby (non-commercial — acceptable here) |
| UI | shadcn/ui (new-york, slate) vendored into `components/ui`, Tailwind v3, `next-themes` |
| DB / Auth / Storage | Supabase Free. Migrations = raw SQL in `supabase/migrations/0001–0004`, run in order |
| DB access | `@supabase/supabase-js` + `@supabase/ssr` (0.12.x — **0.5.x is too old**, collapses types to `never`) |
| Scheduled scraping | GitHub Actions on the public repo (`ingest.yml`, `*/30`, 4 shards) |
| On-demand heavy fetch | Next 15 `after()` inline; optional offload to `ingest-one.yml` via `workflow_dispatch` when `GITHUB_DISPATCH_TOKEN` is set |
| AI | Google Gemini free tier (`gemini-2.5-flash`), daily budget guard via `ai_usage` table |
| HTML parsing | `fetch` + `cheerio`; **Playwright headless Chromium** now used too (see §7) — free because it only runs inside GitHub Actions on the public repo, never on Vercel |
| Logos | `logo.clearbit.com/{domain}` + Google favicon service, plain `<img>` |
| Email | Resend free tier; `send-alerts.ts` runs in "dry-run / log" mode without a key |

### Data cascade (`lib/ingest/run.ts` → `ingestCompany`)
`getAdapter(ats_type)` → if none/unknown and `careers_url` exists → `jsonLdAdapter` on the
careers URL → if still zero jobs and throttled by `companies.ai_extract_attempted_at`
(`AI_EXTRACT_THROTTLE_HOURS`, default 24h) → Gemini `extractJobsWithAi` (`lib/ai/extract-jobs.ts`,
now built into `ingestCompany` itself, not just the on-demand path — see §7) → `normalizeJob` →
`applyDiff` (upsert, close unseen, fan new jobs to watchers via `match_watches` RPC).
`resolveCompany` (`lib/ai/resolve-company.ts`) itself cascades: verified ATS-slug guess →
`lib/ai/web-search.ts` (free DuckDuckGo HTML search) → domain+TLD guessing → Gemini
disambiguation. See §7 for why the ATS-guess and domain-discovery steps needed hardening.

### Keeping Supabase awake
Free Supabase pauses after 7 days idle. The `*/30` `ingest.yml` writes to the DB every run,
which resets the timer. `keepalive.yml` (`*/6h`) is a backup that hits `/api/health`.

---

## 3. Current state

- `npx tsc --noEmit` → **clean**.
- `npx next build` → **passes** (all 16 routes compile; everything is `ƒ` dynamic, expected
  because pages read cookies/DB).
- `npm test` (vitest) → **17 passing**: `early-career`, `normalize`, adapter `registry` (URL detection).
- Dependencies installed (`node_modules/` present); `playwright` added 2026‑09‑06 (see §7).
- Repo is live and **public** on GitHub as `dakshp2005/job-aggregator`; `ingest.yml` /
  `ingest-one.yml` run for real on GitHub Actions (confirmed — this is how §7's fixes were
  verified: unlimited free Actions minutes on a public repo).
- **Migrations applied so far:** `0001`–`0004` (per the user, as of this doc's original
  writing). **`0005_ai_extract_throttle.sql` and `0006_require_auth.sql` are new (§7) and
  still need to be run** against the live Supabase project — nobody has applied them yet.

### Key type gotcha (already solved, don't reintroduce)
`lib/supabase/database.types.ts` uses **`type` aliases, not `interface`**, for every row
shape and the `Database` container. supabase-js's `GenericSchema` constraint requires
`Row/Insert/Update` to satisfy `Record<string, unknown>`; `interface` types don't get an
implicit index signature, so using `interface` makes every query result `never`. Also
`@supabase/ssr` must be ≥ 0.12 to match `@supabase/supabase-js` ≥ 2.114.

---

## 4. Things that are deliberately approximate / need attention

- **Seed ATS slugs** (`data/seed-companies.*.json`) are best-effort. Wrong slugs just log an
  `error` row in `scrape_runs` and set `companies.status='error'` — not fatal, but expect a
  chunk of the first `npm run ingest` to fail until slugs are corrected. Verify against each
  ATS's public board URL. The one duplicate "Ramp" entry in the early-career list is
  harmless (the loader de-dupes by slug).
- **Workday adapter** is experimental — tenant/datacenter/site parsing from the careers URL,
  stored as a composite slug `tenant::dc::site`. Fragile; many Workday tenants also bot-block.
- **`resolveCompany`** (`lib/ai/resolve-company.ts`) does cheap HTTP probes first, then a free
  web search (`lib/ai/web-search.ts`), then domain+TLD guessing, then falls back to Gemini.
  The company-resolution step is surfaced in the fetch UI so a user can see what was picked,
  but there's no "correct this" affordance yet — still a good next feature. See §7 for the
  false-positive-ATS-match and no-JS-content bugs this originally had and how they were fixed.
- **`vercel.json` cron** hits `/api/cron/ingest?limit=20`; Vercel sends
  `Authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` env exists. The route
  checks exactly that.
- **AI budget**: `AI_DAILY_CALL_BUDGET` (default 800) is enforced in `assertAiBudget`. Over
  budget → resolution/extraction throw `AiBudgetError` and the pipeline degrades to
  "structured sources only" / "added, no roles yet".
- **No drag-and-drop** in the tracker Kanban (avoids a dep) — stage changes via small
  "→ Stage" buttons and the edit dialog.
- **`next.config.ts`** logs an `experimental.serverActions` notice — harmless.

---

## 5. Suggested next steps

1. ~~User: create Supabase project, run `0001–0004`, fill `.env.local`, enable GitHub OAuth.~~ Done.
2. ~~`git init`, commit, push to a **public** repo; confirm `ingest.yml` runs.~~ Done — repo is
   live at `dakshp2005/job-aggregator`, Actions confirmed running.
3. **Run the two new migrations** (`0005_ai_extract_throttle.sql`, `0006_require_auth.sql`) —
   not yet applied as of this update.
4. Grow the seed lists (target a few hundred companies) and/or lean on the on-demand fetch —
   now meaningfully stronger after §7's fixes.
5. Nice-to-haves still open: "correct the resolved company" UI on the fetch flow; sitemap/RSS
   diffing for cheaper freshness; a Merge.dev-style unified adapter; salary parsing from
   JSON-LD text; Playwright adapter fixtures for the ATS parsers.
6. Known limitation, accepted rather than fixed (§7): multi-step enterprise recruiting portals
   (Oracle APEX/Taleo, SAP SuccessFactors — e.g. Torrent Power's careers site) need actual
   form interaction/session state, not just a page load. Playwright renders the page as-loaded
   but does not click through multi-step flows. Would need per-vendor navigation logic to fix.

---

## 6. File map (where things live)

- Pages: `app/` (`page.tsx` landing, `search/`, `companies/`, `company/[slug]/`, `dashboard/`,
  `tracker/`, `profile/`, `transparency/`, `login/`).
- API: `app/api/` (`search`, `fetch-company` + `/status`, `health`, `cron/ingest`,
  `revalidate`, `watch`, `application`).
- Ingestion core: `lib/ingest/{run,diff,normalize,early-career,on-demand}.ts`.
- Adapters: `lib/adapters/{greenhouse,lever,ashby,smartrecruiters,recruitee,personio,workday,
  jsonld,registry,http,types}.ts`.
- AI: `lib/ai/{gemini,budget,resolve-company,extract-jobs,web-search,browser-render}.ts` (last
  two added §7 — free DuckDuckGo search + Playwright headless-browser rendering).
- Supabase: `lib/supabase/{client,server,admin,middleware,database.types}.ts`, root `middleware.ts`.
- Scripts: `scripts/{seed,ingest-all,ingest-one,refresh-stale,send-alerts,_env}.ts`.
- SQL: `supabase/migrations/0001_init.sql` … `0006_require_auth.sql` (`0005`, `0006` added §7,
  **not yet applied**).
- Tests: `lib/**/*.test.ts`, `vitest.config.ts`.
- Design plan: `../.claude/plans/i-have-idea-for-serene-hippo.md` (original build);
  `../.claude/plans/i-want-to-ask-velvet-crane.md` (§7's fixes).

---

## 7. Session — 2026‑09‑06: fixing on-demand company resolution end to end

The user asked a simple operational question ("do I have to re-seed to get new roles?") that
led into a real bug hunt once they tried searching for companies not on any ATS (Torrent Power,
Simform, Playpower, Rapidops — local/Indian companies). Fixed in order, each verified live
against the real companies before moving on:

1. **Scheduled cron never used the AI-extraction fallback.** `extractJobsWithAi` existed but
   was only wired into the on-demand path (`lib/ingest/on-demand.ts`); the recurring 30-min
   cron (`ingestCompany` in `lib/ingest/run.ts`) stopped at JSON-LD. Moved the AI-extraction
   call into `ingestCompany` itself, throttled per company via a new
   `companies.ai_extract_attempted_at` column (`AI_EXTRACT_THROTTLE_HOURS`, default 24h) so it
   doesn't burn the shared Gemini daily budget every 30 minutes. Migration:
   `0005_ai_extract_throttle.sql`. `on-demand.ts` simplified to just call `ingestCompany`.

2. **False-positive Ashby matches.** `resolveCompany`'s ATS-guess step trusted any HTTP 200 on
   a guessed URL. Turns out `jobs.ashbyhq.com/<slug>` is a client-rendered SPA that returns 200
   for *any* slug (real or not), and SmartRecruiters/Recruitee/Personio redirect a nonexistent
   slug to their marketing homepage (also 200) — so every unmatched company was confidently
   (and wrongly) resolved to Ashby with a dead careers link. Added `verifyGuess()`
   (`lib/ai/resolve-company.ts`): Ashby now double-checks the real
   `api.ashbyhq.com/posting-api/job-board/<slug>` endpoint (which correctly 404s); the others
   check that the final URL after redirects still contains the guessed slug/subdomain.

3. **Real companies still showed "no open roles" even with a correct careers page found.**
   Root cause: `extractJobsWithAi` only ever saw the server's first HTML response — never ran
   the page's own JavaScript. Most modern career pages (React/Vue widgets, AJAX-loaded
   listings) are empty in that first response. Added `lib/ai/browser-render.ts`
   (`renderPageText`): a real headless Chromium via `playwright`, gated behind
   `ENABLE_BROWSER_RENDER=true` (set only in `.github/workflows/ingest.yml` /
   `ingest-one.yml`, where Chromium is installed — this repo is **public**, so GitHub Actions
   minutes are free and unlimited; deliberately never enabled on the Vercel serverless path,
   avoiding bundling/size problems there). `extractJobsWithAi` tries the browser render first,
   falls back to the old plain-fetch text when rendering is unavailable/fails.

4. **A "/careers" landing page often just links to the real listings page.** Discovered live:
   Simform's `/careers/` page has zero job content — the actual 24 openings live at
   `/current-openings/`, linked from the landing page. `extractJobsWithAi` now does one hop:
   if the first page yields zero jobs, it looks for an inlined `<<url>>` token matching
   `current-openings|open-positions|open-roles|job-openings|openings|vacancies|positions` and
   retries extraction there. Verified end to end with a real Gemini call: 10 real jobs
   extracted from Simform (Sr. Python Developer, Technical Project Manager, AI Tech Lead, …).
   Deliberately out of scope: multi-step portals needing actual clicks/form submission
   (Oracle APEX/Taleo-style — e.g. Torrent Power) — "render as-loaded" only, no auto-clicking.

5. **On-demand fetch never re-resolves a company stuck in `status: 'error'`.** `applyResolved`
   in `lib/ingest/on-demand.ts` used to only fill in *missing* fields on an existing company
   row, so the bad pre-fix Ashby data for Torrent Power/Simform would never self-correct.
   Confirmed live via a direct DB query before fixing. Now a `status: 'error'` row (never
   successfully scraped) gets fully re-resolved instead of gap-filled — self-heals the next
   time the company is searched, no manual DB fix needed.

6. **Traced the full user flow** (search → not-found → on-demand fetch → progress UI →
   company page) end to end per the user's request, and found/fixed three real gaps against
   the intended behavior:
   - **Sign-in wasn't actually required anywhere** — search and on-demand fetch worked fully
     anonymously (the DB even explicitly granted `enqueue_fetch_request` to `anon`). Now
     gated at every layer: `middleware.ts` protects `/search`, the search page itself
     redirects, the command palette redirects to `/login` instead of opening for anonymous
     users, both `/api/search` and `/api/fetch-company` return 401, and
     `0006_require_auth.sql` revokes `anon` execute on `search_companies` and
     `enqueue_fetch_request` at the database level too.
   - **"Try again" after a failed fetch didn't really retry** — `enqueue_fetch_request`
     deduped against *any* recent request for the same query regardless of status, so a retry
     just got back the same stale `failed` row. Fixed in the same `0006` migration: the dedup
     window now only matches requests still actually in flight
     (`pending`/`resolving`/`scraping`/`extracting`).
   - **The "Extracting with AI" progress step was dead** — the UI has a step for it but
     `processFetchRequest` never set that status, since the AI-extraction logic had moved
     inside `ingestCompany` (item 1 above) with no way to report back. Added an optional
     `onStatus` callback to `ingestCompany`, wired up in `on-demand.ts`.

**New files this session:** `lib/ai/web-search.ts`, `lib/ai/browser-render.ts`,
`supabase/migrations/0005_ai_extract_throttle.sql`, `0006_require_auth.sql`.
**New dependency:** `playwright` (Chromium installed only in CI, via
`npx playwright install --with-deps chromium` in both ingest workflows).
**Not yet done:** apply `0005` and `0006` to the live Supabase project — everything else is
already pushed/verified working, this is the one outstanding manual step.

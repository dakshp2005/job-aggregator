# Session Log — OpenRoles build

Handoff document for another developer or AI picking this up. Written 2026‑09‑04.

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
| HTML parsing | `fetch` + `cheerio`, **no headless browser** (no viable free tier) |
| Logos | `logo.clearbit.com/{domain}` + Google favicon service, plain `<img>` |
| Email | Resend free tier; `send-alerts.ts` runs in "dry-run / log" mode without a key |

### Data cascade (`lib/ingest/run.ts` → `ingestCompany`)
`getAdapter(ats_type)` → if none/unknown and `careers_url` exists → `jsonLdAdapter` on the
careers URL → `normalizeJob` → `applyDiff` (upsert, close unseen, fan new jobs to watchers via
`match_watches` RPC). On-demand adds a Gemini `extractJobsWithAi` step when structured
parsing yields nothing (`lib/ingest/on-demand.ts`).

### Keeping Supabase awake
Free Supabase pauses after 7 days idle. The `*/30` `ingest.yml` writes to the DB every run,
which resets the timer. `keepalive.yml` (`*/6h`) is a backup that hits `/api/health`.

---

## 3. Current state

- `npx tsc --noEmit` → **clean**.
- `npx next build` → **passes** (all 16 routes compile; everything is `ƒ` dynamic, expected
  because pages read cookies/DB).
- `npm test` (vitest) → **17 passing**: `early-career`, `normalize`, adapter `registry` (URL detection).
- Dependencies installed (`node_modules/` present, ~500 packages).
- **Not yet run:** the SQL migrations, `npm run seed`, `npm run ingest` — these need a real
  Supabase project + env, which the user will set up.
- **Not yet done:** git init / first commit / push (waiting on the user).

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
- **`resolveCompany`** (`lib/ai/resolve-company.ts`) does cheap HTTP probes first, then falls
  back to Gemini. Its domain-guessing (`{name}.com/.io/.ai/...`) is heuristic and will miss
  companies whose domain doesn't match their name. The company-resolution step is surfaced in
  the fetch UI so a user can see what was picked, but there's no "correct this" affordance yet
  — a good next feature.
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

1. User: create Supabase project, run `0001–0004`, fill `.env.local`, enable GitHub OAuth.
2. `npm run seed && npm run ingest -- --of=1 --shard=0`; fix any slugs that 404 in
   `/transparency`.
3. `git init`, commit, push to a **public** repo; add the Actions secrets/variables from the
   README; confirm `ingest.yml` runs.
4. Import to Vercel, set env vars, set `NEXT_PUBLIC_SITE_URL`.
5. Grow the seed lists (target a few hundred companies) and/or lean on the on-demand fetch.
6. Nice-to-haves: "correct the resolved company" UI on the fetch flow; sitemap/RSS diffing
   for cheaper freshness; a Merge.dev-style unified adapter; salary parsing from JSON-LD text;
   Playwright adapter fixtures for the ATS parsers.

---

## 6. File map (where things live)

- Pages: `app/` (`page.tsx` landing, `search/`, `companies/`, `company/[slug]/`, `dashboard/`,
  `tracker/`, `profile/`, `transparency/`, `login/`).
- API: `app/api/` (`search`, `fetch-company` + `/status`, `health`, `cron/ingest`,
  `revalidate`, `watch`, `application`).
- Ingestion core: `lib/ingest/{run,diff,normalize,early-career,on-demand}.ts`.
- Adapters: `lib/adapters/{greenhouse,lever,ashby,smartrecruiters,recruitee,personio,workday,
  jsonld,registry,http,types}.ts`.
- AI: `lib/ai/{gemini,budget,resolve-company,extract-jobs}.ts`.
- Supabase: `lib/supabase/{client,server,admin,middleware,database.types}.ts`, root `middleware.ts`.
- Scripts: `scripts/{seed,ingest-all,ingest-one,refresh-stale,send-alerts,_env}.ts`.
- SQL: `supabase/migrations/0001_init.sql` … `0004_storage.sql`.
- Tests: `lib/**/*.test.ts`, `vitest.config.ts`.
- Design plan: `../.claude/plans/i-have-idea-for-serene-hippo.md`.

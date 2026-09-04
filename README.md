# OpenRoles

A **company-centric** job & interview aggregator. Search a company, see every open role
(and likely-upcoming ones), each with a direct link to the real application form. If a
company isn't indexed yet, an **AI agent fetches it live** from its own careers page and adds
it permanently — so the dataset grows along the exact contour of user demand.

Runs entirely on **permanent free tiers**. No credit card required anywhere (Resend for email
is optional and degrades to a dry-run).

---

## What's in the box

| Area | Details |
|---|---|
| App | Next.js 15 (App Router) + Tailwind + **shadcn/ui**, deploy on **Vercel Hobby** |
| Data | **Supabase** Postgres + Auth + Storage. Migrations are plain SQL you run yourself |
| Ingestion | ATS adapters (Greenhouse, Lever, Ashby, SmartRecruiters, Recruitee, Personio, Workday) → JSON-LD scraping → AI extraction. Runs on **GitHub Actions** (unlimited on public repos) |
| AI | **Google Gemini** free tier — company resolution + bespoke-page extraction only, with a daily budget guard |
| Accounts | Magic-link + GitHub OAuth, watchlist + email alerts, application tracker (Kanban), profile + résumé with a "copy my profile" helper on every job |

Full design rationale: `../.claude/plans/i-have-idea-for-serene-hippo.md`.
Handoff notes for another developer/AI: `SESSION_LOG.md`.

---

## Setup

### 1. Supabase project + migrations

1. Create a free project at [supabase.com](https://supabase.com).
2. In the **SQL Editor**, run these files **in order** (paste and execute each):
   ```
   supabase/migrations/0001_init.sql
   supabase/migrations/0002_rls.sql
   supabase/migrations/0003_functions.sql
   supabase/migrations/0004_storage.sql
   ```
   (Or, with the Supabase CLI linked: `supabase db push`.)
3. **Auth → Providers**: enable GitHub (create an OAuth app, callback
   `https://<project>.supabase.co/auth/v1/callback`). Magic-link works out of the box.
4. **Auth → URL Configuration**: add `http://localhost:3000/**` and your Vercel URL to the
   redirect allow-list.

### 2. Environment

```bash
cp .env.example .env.local
```

Fill in:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  (Supabase → Project Settings → API)
- `GEMINI_API_KEY` (free, no card: <https://aistudio.google.com/apikey>)
- `CRON_SECRET` — any long random string
- `NEXT_PUBLIC_SITE_URL` — `http://localhost:3000` locally
- Optional: `RESEND_API_KEY`, `GITHUB_DISPATCH_TOKEN` + `GITHUB_REPO`

### 3. Run

```bash
npm install
npm run dev            # http://localhost:3000
```

### 4. Populate data

```bash
npm run seed                       # ~60 curated companies into `companies`
npm run ingest -- --of=1 --shard=0 # scrape all of them into `jobs`
npm test                           # adapter + heuristic unit tests
```

Then open `/` and search "Stripe", or search something obscure to watch the live AI fetch.

---

## Deploy (all free)

### Vercel (app)

1. Push this folder to a **public** GitHub repo.
2. Import into Vercel. Framework auto-detects as Next.js.
3. Add every var from `.env.local` to Vercel → Settings → Environment Variables.
   Set `NEXT_PUBLIC_SITE_URL` to the real deployment URL.
4. `vercel.json` registers one daily backup cron hitting `/api/cron/ingest` (Hobby allows
   one/day). The real cadence comes from GitHub Actions below.

> Vercel Hobby is **non-commercial only** — fine for this project. If that ever changes,
> Cloudflare Pages is a drop-in alternative.

### GitHub Actions (the ingestion workhorse)

Repo → Settings → Secrets and variables → Actions:

**Secrets:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `CRON_SECRET`,
`RESEND_API_KEY` (optional)
**Variables:** `SITE_URL`, `SCRAPER_CONTACT_URL`, `GEMINI_MODEL` (opt), `AI_DAILY_CALL_BUDGET` (opt),
`ALERTS_FROM_EMAIL` (opt)

Workflows:

| File | Schedule | Purpose |
|---|---|---|
| `ingest.yml` | every 30 min | scrape all companies, 4 parallel shards |
| `ingest-one.yml` | `workflow_dispatch` | on-demand fetch of a single company (used by the app when `GITHUB_DISPATCH_TOKEN` is set) |
| `keepalive.yml` | every 6 h | ping `/api/health` + touch Supabase so the free project never pauses |
| `alerts.yml` | daily 13:00 UTC | email digests of new roles in watched companies |

The 30-minute `ingest.yml` alone keeps Supabase awake (it writes every run).

---

## How the on-demand AI fetch works

1. Search a company we don't have → **"Fetch it now"**.
2. `POST /api/fetch-company` rate-limits (5/IP/hour, 200/day global via the
   `enqueue_fetch_request` RPC), inserts a `fetch_requests` row, returns immediately.
3. Processing runs in Next's `after()` (or is offloaded to `ingest-one.yml` if
   `GITHUB_DISPATCH_TOKEN` is set): resolve company → detect ATS → run adapter →
   fall back to JSON-LD → fall back to Gemini extraction → upsert.
4. The client polls `/api/fetch-company/status` and redirects to the new company page.
5. The company is now permanent and picked up by the 30-minute cron.

---

## Data & scraping policy

- Official ATS JSON feeds are used wherever possible; HTML scraping is a fallback.
- Descriptive `User-Agent` with a contact URL; ≤ 1 request/second per host.
- Public data only. Removal requests: set `companies.status = 'error'` (the ingester skips it).
- Non-commercial use.

---

## Project layout

```
app/                 routes (pages + /api handlers)
components/           feature components + components/ui (shadcn, vendored)
lib/
  supabase/          browser / server / admin clients + hand-written DB types
  adapters/          one file per ATS + jsonld fallback + registry
  ingest/            normalize, early-career heuristics, diff, run, on-demand pipeline
  ai/                gemini client, company resolver, job extractor, budget guard
  data.ts            server-side read helpers for pages
scripts/             seed / ingest-all / ingest-one / refresh-stale / send-alerts (run with tsx)
supabase/migrations/ 0001-0004 SQL — run in order
data/                seed company lists (general + early-career)
.github/workflows/   ingest, ingest-one, keepalive, alerts
```

## Regenerating DB types

`lib/supabase/database.types.ts` is hand-maintained. Once the CLI is linked:

```bash
supabase gen types typescript --project-id <id> > lib/supabase/database.types.ts
```

> Keep it a `type` (not `interface`) — supabase-js's generics collapse to `never` otherwise.

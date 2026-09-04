-- ════════════════════════════════════════════════════════════════════════════
-- OpenRoles — 0002_rls.sql
-- Row-level security. Deny-by-default: enabling RLS with no policy blocks all
-- access via the anon/auth keys. The service-role key bypasses RLS entirely
-- and is what the ingestion scripts + server routes use for writes.
-- Run AFTER 0001_init.sql.
-- ════════════════════════════════════════════════════════════════════════════

alter table profiles        enable row level security;
alter table companies       enable row level security;
alter table jobs            enable row level security;
alter table fetch_requests  enable row level security;
alter table watches         enable row level security;
alter table applications    enable row level security;
alter table scrape_runs     enable row level security;
alter table alerts_queue    enable row level security;
alter table ai_usage        enable row level security;
alter table request_log     enable row level security;

-- ── Public read-only catalog ──────────────────────────────────────────────
drop policy if exists "companies are public" on companies;
create policy "companies are public" on companies
  for select using (true);

drop policy if exists "jobs are public" on jobs;
create policy "jobs are public" on jobs
  for select using (true);

drop policy if exists "scrape runs are public" on scrape_runs;
create policy "scrape runs are public" on scrape_runs
  for select using (true);

-- ai_usage / request_log: no policies at all -> only service role can touch them.

-- ── profiles: owner only ─────────────────────────────────────────────────
drop policy if exists "own profile - select" on profiles;
create policy "own profile - select" on profiles
  for select using (auth.uid() = id);

drop policy if exists "own profile - upsert" on profiles;
create policy "own profile - upsert" on profiles
  for insert with check (auth.uid() = id);

drop policy if exists "own profile - update" on profiles;
create policy "own profile - update" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ── watches: owner only ──────────────────────────────────────────────────
drop policy if exists "own watches - all" on watches;
create policy "own watches - all" on watches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── applications: owner only ─────────────────────────────────────────────
drop policy if exists "own applications - all" on applications;
create policy "own applications - all" on applications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── alerts_queue: owner may read (writes happen via service role) ────────
drop policy if exists "own alerts - select" on alerts_queue;
create policy "own alerts - select" on alerts_queue
  for select using (auth.uid() = user_id);

-- ── fetch_requests ──────────────────────────────────────────────────────
-- Anyone (incl. anonymous) can read a request row by id to poll its status.
-- Inserts are funnelled through the `enqueue_fetch_request` RPC (0003) which
-- runs as SECURITY DEFINER and applies rate limiting, so there is no direct
-- INSERT policy here.
drop policy if exists "fetch requests - read by id" on fetch_requests;
create policy "fetch requests - read by id" on fetch_requests
  for select using (true);

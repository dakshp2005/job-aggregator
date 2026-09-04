-- ════════════════════════════════════════════════════════════════════════════
-- OpenRoles — 0001_init.sql
-- Core schema: enums, tables, indexes, triggers.
-- Run this FIRST, then 0002_rls.sql, 0003_functions.sql, 0004_storage.sql.
-- Safe to re-run (uses IF NOT EXISTS / DROP ... IF EXISTS where practical).
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "pg_trgm";        -- fuzzy company search
create extension if not exists "unaccent";       -- accent-insensitive search

-- ── Enums ──────────────────────────────────────────────────────────────────
do $$ begin
  create type company_status as enum ('active', 'limited', 'error', 'pending');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ats_type as enum (
    'greenhouse', 'lever', 'ashby', 'smartrecruiters',
    'recruitee', 'personio', 'workday', 'jsonld', 'unknown'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type fetch_status as enum (
    'pending', 'resolving', 'scraping', 'extracting', 'done', 'failed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type application_stage as enum (
    'saved', 'applied', 'phone_screen', 'onsite', 'offer', 'rejected', 'withdrawn'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type run_status as enum ('ok', 'partial', 'error');
exception when duplicate_object then null; end $$;

-- ── updated_at helper ──────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ── profiles ───────────────────────────────────────────────────────────────
create table if not exists profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  full_name    text,
  headline     text,
  location     text,
  phone        text,
  links        jsonb not null default '{}'::jsonb,   -- {linkedin, github, portfolio, ...}
  resume_url   text,                                  -- storage path in `resumes` bucket
  resume_text  text,                                  -- plain-text résumé for copy-paste
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
drop trigger if exists trg_profiles_updated on profiles;
create trigger trg_profiles_updated before update on profiles
  for each row execute function set_updated_at();

-- Auto-create a profile row when a new auth user appears.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ── companies ──────────────────────────────────────────────────────────────
create table if not exists companies (
  id                        uuid primary key default gen_random_uuid(),
  name                      text not null,
  slug                      text not null unique,
  domain                    text,
  logo_url                  text,
  careers_url               text,
  ats_type                  ats_type not null default 'unknown',
  ats_slug                  text,
  hq_country                text,
  tags                      text[] not null default '{}',
  is_early_career_friendly  boolean not null default false,
  status                    company_status not null default 'pending',
  source                    text not null default 'seed',   -- 'seed' | 'on-demand' | 'manual'
  description               text,
  last_scraped_at           timestamptz,
  last_scrape_status        run_status,
  open_jobs_count           integer not null default 0,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
drop trigger if exists trg_companies_updated on companies;
create trigger trg_companies_updated before update on companies
  for each row execute function set_updated_at();

create index if not exists idx_companies_name_trgm on companies using gin (name gin_trgm_ops);
create index if not exists idx_companies_slug_trgm on companies using gin (slug gin_trgm_ops);
create index if not exists idx_companies_tags on companies using gin (tags);
create index if not exists idx_companies_status on companies (status);
create index if not exists idx_companies_early on companies (is_early_career_friendly) where is_early_career_friendly;

-- ── jobs ───────────────────────────────────────────────────────────────────
create table if not exists jobs (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references companies (id) on delete cascade,
  source_uid           text not null,                 -- stable id from the ATS
  title                text not null,
  normalized_title     text,
  department           text,
  team                 text,
  location_raw         text,
  locations            text[] not null default '{}',
  is_remote            boolean not null default false,
  employment_type      text,                          -- full_time | intern | contract | ...
  experience_level     text,                          -- intern | entry | mid | senior | ...
  is_early_career      boolean not null default false,
  apply_url            text not null,
  description_snippet  text,
  description_html     text,
  salary_min           numeric,
  salary_max           numeric,
  salary_currency      text,
  posted_at            timestamptz,
  first_seen_at        timestamptz not null default now(),
  last_seen_at         timestamptz not null default now(),
  is_open              boolean not null default true,
  confidence           numeric not null default 1.0,  -- 1.0 structured, <1 AI-extracted
  source               text not null default 'ats',   -- ats | jsonld | ai
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (company_id, source_uid)
);
drop trigger if exists trg_jobs_updated on jobs;
create trigger trg_jobs_updated before update on jobs
  for each row execute function set_updated_at();

create index if not exists idx_jobs_company on jobs (company_id);
create index if not exists idx_jobs_open on jobs (company_id, is_open);
create index if not exists idx_jobs_first_seen on jobs (first_seen_at desc);
create index if not exists idx_jobs_early on jobs (is_early_career) where is_early_career;
create index if not exists idx_jobs_title_trgm on jobs using gin (title gin_trgm_ops);
create index if not exists idx_jobs_locations on jobs using gin (locations);

-- Keep companies.open_jobs_count in sync.
create or replace function refresh_company_open_count()
returns trigger language plpgsql as $$
declare cid uuid;
begin
  cid := coalesce(new.company_id, old.company_id);
  update companies c
    set open_jobs_count = (select count(*) from jobs j where j.company_id = cid and j.is_open)
  where c.id = cid;
  return null;
end $$;
drop trigger if exists trg_jobs_count on jobs;
create trigger trg_jobs_count after insert or update of is_open or delete on jobs
  for each row execute function refresh_company_open_count();

-- ── fetch_requests (on-demand "AI go get it") ─────────────────────────────
create table if not exists fetch_requests (
  id                   uuid primary key default gen_random_uuid(),
  raw_query            text not null,
  normalized_query     text not null,
  requested_by         uuid references auth.users (id) on delete set null,
  requester_ip         text,
  status               fetch_status not null default 'pending',
  resolved_company_id  uuid references companies (id) on delete set null,
  message              text,                          -- human-readable progress line
  error                text,
  created_at           timestamptz not null default now(),
  completed_at         timestamptz
);
create index if not exists idx_fetch_requests_created on fetch_requests (created_at desc);
create index if not exists idx_fetch_requests_norm on fetch_requests (normalized_query);

-- ── watches ────────────────────────────────────────────────────────────────
create table if not exists watches (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  company_id    uuid not null references companies (id) on delete cascade,
  notify_email  boolean not null default true,
  last_seen_at  timestamptz not null default now(),   -- for the "new since last visit" feed
  created_at    timestamptz not null default now(),
  unique (user_id, company_id)
);
create index if not exists idx_watches_user on watches (user_id);
create index if not exists idx_watches_company on watches (company_id);

-- ── applications (tracker) ────────────────────────────────────────────────
create table if not exists applications (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  job_id            uuid references jobs (id) on delete set null,
  company_id        uuid references companies (id) on delete set null,
  title             text not null,
  company_name      text,
  apply_url         text,
  stage             application_stage not null default 'saved',
  applied_at        timestamptz,
  notes             text,
  next_action       text,
  next_action_date  date,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
drop trigger if exists trg_applications_updated on applications;
create trigger trg_applications_updated before update on applications
  for each row execute function set_updated_at();
create index if not exists idx_applications_user on applications (user_id, stage, sort_order);

-- ── scrape_runs (transparency + debugging) ───────────────────────────────
create table if not exists scrape_runs (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid references companies (id) on delete cascade,
  adapter      text not null,
  status       run_status not null,
  jobs_found   integer not null default 0,
  jobs_added   integer not null default 0,
  jobs_closed  integer not null default 0,
  duration_ms  integer,
  error        text,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz
);
create index if not exists idx_scrape_runs_company on scrape_runs (company_id, started_at desc);
create index if not exists idx_scrape_runs_started on scrape_runs (started_at desc);

-- ── alerts_queue (email digests) ─────────────────────────────────────────
create table if not exists alerts_queue (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  job_id      uuid not null references jobs (id) on delete cascade,
  watch_id    uuid references watches (id) on delete cascade,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,
  unique (user_id, job_id)
);
create index if not exists idx_alerts_unsent on alerts_queue (user_id) where sent_at is null;

-- ── ai_usage (Gemini free-tier budget guard) ─────────────────────────────
create table if not exists ai_usage (
  day    date primary key default current_date,
  calls  integer not null default 0
);

-- ── request_log (rate limiting for on-demand fetch) ─────────────────────
create table if not exists request_log (
  id          bigserial primary key,
  ip          text,
  user_id     uuid,
  kind        text not null default 'fetch-company',
  created_at  timestamptz not null default now()
);
create index if not exists idx_request_log_recent on request_log (ip, created_at desc);

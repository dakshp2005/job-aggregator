-- ════════════════════════════════════════════════════════════════════════════
-- OpenRoles — 0003_functions.sql
-- RPCs called from the app (via supabase.rpc(...)) and ingestion scripts.
-- Run AFTER 0002_rls.sql.
-- ════════════════════════════════════════════════════════════════════════════

-- ── search_companies ─────────────────────────────────────────────────────
-- Fuzzy, accent-insensitive company search ranked by trigram similarity with
-- exact / prefix boosts. Used by /api/search and the landing <Command> box.
create or replace function search_companies(q text, lim int default 10)
returns table (
  id uuid,
  name text,
  slug text,
  domain text,
  logo_url text,
  ats_type ats_type,
  tags text[],
  is_early_career_friendly boolean,
  open_jobs_count integer,
  score real
)
language sql stable as $$
  with needle as (select unaccent(lower(trim(q))) as n)
  select c.id, c.name, c.slug, c.domain, c.logo_url, c.ats_type, c.tags,
         c.is_early_career_friendly, c.open_jobs_count,
         greatest(
           similarity(unaccent(lower(c.name)), (select n from needle)),
           similarity(unaccent(lower(c.slug)), (select n from needle))
         )
         + case when unaccent(lower(c.name)) = (select n from needle) then 1.0 else 0 end
         + case when unaccent(lower(c.name)) like (select n from needle) || '%' then 0.3 else 0 end
         as score
  from companies c
  where c.status <> 'error'
    and (
      unaccent(lower(c.name)) % (select n from needle)
      or unaccent(lower(c.slug)) % (select n from needle)
      or unaccent(lower(c.name)) like '%' || (select n from needle) || '%'
    )
  order by score desc, c.open_jobs_count desc
  limit greatest(1, least(lim, 50));
$$;

-- ── enqueue_fetch_request ────────────────────────────────────────────────
-- SECURITY DEFINER: runs with table-owner rights so it can write to
-- request_log / fetch_requests despite RLS. Applies per-IP hourly rate
-- limiting and a global daily ceiling, and de-dupes rapid repeat queries.
create or replace function enqueue_fetch_request(
  p_query text,
  p_ip text default null,
  p_user uuid default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_norm text := regexp_replace(lower(trim(coalesce(p_query, ''))), '\s+', ' ', 'g');
  v_ip_count int;
  v_day_count int;
  v_existing uuid;
  v_id uuid;
begin
  if length(v_norm) < 2 then
    raise exception 'query too short';
  end if;

  -- Return an in-flight / very recent request for the same query instead of
  -- spawning a duplicate crawl.
  select id into v_existing
  from fetch_requests
  where normalized_query = v_norm
    and created_at > now() - interval '10 minutes'
  order by created_at desc
  limit 1;
  if v_existing is not null then
    return v_existing;
  end if;

  -- Per-IP: max 5 / hour.
  if p_ip is not null then
    select count(*) into v_ip_count
    from request_log
    where ip = p_ip and kind = 'fetch-company'
      and created_at > now() - interval '1 hour';
    if v_ip_count >= 5 then
      raise exception 'rate limited: too many fetch requests from this address, try again later';
    end if;
  end if;

  -- Global: max 200 on-demand crawls / day (protects the Gemini free tier).
  select count(*) into v_day_count
  from request_log
  where kind = 'fetch-company' and created_at > now() - interval '24 hours';
  if v_day_count >= 200 then
    raise exception 'rate limited: daily fetch budget reached, try again tomorrow';
  end if;

  insert into request_log (ip, user_id, kind) values (p_ip, p_user, 'fetch-company');
  insert into fetch_requests (raw_query, normalized_query, requested_by, requester_ip, status, message)
  values (p_query, v_norm, p_user, p_ip, 'pending', 'Queued')
  returning id into v_id;

  return v_id;
end $$;

revoke all on function enqueue_fetch_request(text, text, uuid) from public;
grant execute on function enqueue_fetch_request(text, text, uuid) to anon, authenticated;

-- ── match_watches ────────────────────────────────────────────────────────
-- Called by the ingestion pipeline (service role) for every newly inserted
-- open job. Fans the job out into alerts_queue for each interested watcher.
create or replace function match_watches(p_job_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  with j as (select company_id from jobs where id = p_job_id)
  insert into alerts_queue (user_id, job_id, watch_id)
  select w.user_id, p_job_id, w.id
  from watches w, j
  where w.company_id = j.company_id
    and w.notify_email
  on conflict (user_id, job_id) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ── AI budget helpers ────────────────────────────────────────────────────
create or replace function increment_ai_usage()
returns int
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  insert into ai_usage (day, calls) values (current_date, 1)
  on conflict (day) do update set calls = ai_usage.calls + 1
  returning calls into v;
  return v;
end $$;

create or replace function get_ai_usage()
returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select calls from ai_usage where day = current_date), 0);
$$;

-- ── platform_stats (landing page counters) ──────────────────────────────
create or replace function platform_stats()
returns json
language sql stable as $$
  select json_build_object(
    'companies', (select count(*) from companies where status = 'active'),
    'open_jobs', (select count(*) from jobs where is_open),
    'early_career_jobs', (select count(*) from jobs where is_open and is_early_career),
    'last_updated', (select max(finished_at) from scrape_runs)
  );
$$;

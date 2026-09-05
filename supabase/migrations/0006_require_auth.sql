-- ════════════════════════════════════════════════════════════════════════════
-- OpenRoles — 0006_require_auth.sql
-- 1) Search and on-demand company fetch now require a signed-in user — the
--    Next.js routes already enforce this, this closes the same gap at the
--    database level so a direct RPC call with the anon key is blocked too.
-- 2) Fixes the "Try again" retry bug: enqueue_fetch_request used to dedupe
--    against ANY recent request for the same query regardless of outcome,
--    so retrying a failed fetch just returned the same stale failed row.
--    Now only requests that are still actually in flight get deduped.
-- ════════════════════════════════════════════════════════════════════════════

revoke all on function search_companies(text, int) from public;
grant execute on function search_companies(text, int) to authenticated;

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

  -- Return an in-flight request for the same query instead of spawning a
  -- duplicate crawl. A terminal (done/failed) row no longer counts, so a
  -- retry after failure always gets a fresh attempt.
  select id into v_existing
  from fetch_requests
  where normalized_query = v_norm
    and created_at > now() - interval '10 minutes'
    and status in ('pending', 'resolving', 'scraping', 'extracting')
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
grant execute on function enqueue_fetch_request(text, text, uuid) to authenticated;

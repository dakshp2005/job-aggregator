-- ════════════════════════════════════════════════════════════════════════════
-- OpenRoles — 0004_storage.sql
-- Private "resumes" storage bucket + owner-scoped access policies.
-- Files are stored under a per-user prefix: `<auth.uid()>/<filename>`.
-- Run AFTER 0003_functions.sql.
-- ════════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resumes', 'resumes', false, 5242880,
  array['application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "resumes - read own" on storage.objects;
create policy "resumes - read own" on storage.objects
  for select using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "resumes - upload own" on storage.objects;
create policy "resumes - upload own" on storage.objects
  for insert with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "resumes - update own" on storage.objects;
create policy "resumes - update own" on storage.objects
  for update using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "resumes - delete own" on storage.objects;
create policy "resumes - delete own" on storage.objects
  for delete using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

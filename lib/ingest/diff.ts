import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { JobInsert } from "./normalize";

export interface DiffResult {
  found: number;
  added: number;
  updated: number;
  closed: number;
  newJobIds: string[];
}

type Admin = SupabaseClient<Database>;

/**
 * Reconcile the freshly-scraped postings for one company against what's in the
 * DB: upsert everything seen now, mark anything previously-open but no longer
 * present as closed, and fan new postings out to watchers.
 */
export async function applyDiff(
  admin: Admin,
  companyId: string,
  jobs: JobInsert[],
): Promise<DiffResult> {
  const now = new Date().toISOString();

  const { data: existing, error: exErr } = await admin
    .from("jobs")
    .select("id, source_uid, is_open")
    .eq("company_id", companyId);
  if (exErr) throw exErr;

  const existingByUid = new Map((existing ?? []).map((r) => [r.source_uid, r]));
  const seenUids = new Set(jobs.map((j) => j.source_uid));

  const rows = jobs.map((j) => ({
    ...j,
    company_id: companyId,
    is_open: true,
    last_seen_at: now,
  }));

  let added = 0;
  let updated = 0;
  const newJobIds: string[] = [];

  // Upsert in chunks to keep payloads small.
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { data: up, error } = await admin
      .from("jobs")
      .upsert(chunk, { onConflict: "company_id,source_uid" })
      .select("id, source_uid");
    if (error) throw error;
    for (const r of up ?? []) {
      if (existingByUid.has(r.source_uid)) updated++;
      else {
        added++;
        newJobIds.push(r.id);
      }
    }
  }

  // Close postings that were open but weren't seen this run.
  const toClose = (existing ?? [])
    .filter((r) => r.is_open && !seenUids.has(r.source_uid))
    .map((r) => r.id);
  let closed = 0;
  if (toClose.length) {
    const { error } = await admin
      .from("jobs")
      .update({ is_open: false, last_seen_at: now })
      .in("id", toClose);
    if (error) throw error;
    closed = toClose.length;
  }

  // Fan out new roles to watchers (best-effort; don't fail the run on this).
  for (const jobId of newJobIds) {
    try {
      await admin.rpc("match_watches", { p_job_id: jobId });
    } catch {
      /* ignore */
    }
  }

  return { found: jobs.length, added, updated, closed, newJobIds };
}

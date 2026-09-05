/**
 * Hand-maintained mirror of the SQL in `supabase/migrations/`.
 * Regenerate with the Supabase CLI once you have a project linked:
 *   supabase gen types typescript --project-id <id> > lib/supabase/database.types.ts
 *
 * IMPORTANT: every shape here is a `type` alias, not an `interface`. supabase-js's
 * `GenericSchema` constraint requires `Row`/`Insert`/`Update` to satisfy
 * `Record<string, unknown>`, and `interface` types do NOT (no implicit index
 * signature) — using `interface` makes every query result collapse to `never`.
 */

export type CompanyStatus = "active" | "limited" | "error" | "pending";
export type AtsType =
  | "greenhouse"
  | "lever"
  | "ashby"
  | "smartrecruiters"
  | "recruitee"
  | "personio"
  | "workday"
  | "jsonld"
  | "unknown";
export type FetchStatus =
  | "pending"
  | "resolving"
  | "scraping"
  | "extracting"
  | "done"
  | "failed";
export type ApplicationStage =
  | "saved"
  | "applied"
  | "phone_screen"
  | "onsite"
  | "offer"
  | "rejected"
  | "withdrawn";
export type RunStatus = "ok" | "partial" | "error";

export type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  logo_url: string | null;
  careers_url: string | null;
  ats_type: AtsType;
  ats_slug: string | null;
  hq_country: string | null;
  tags: string[];
  is_early_career_friendly: boolean;
  status: CompanyStatus;
  source: string;
  description: string | null;
  last_scraped_at: string | null;
  last_scrape_status: RunStatus | null;
  ai_extract_attempted_at: string | null;
  open_jobs_count: number;
  created_at: string;
  updated_at: string;
};

export type JobRow = {
  id: string;
  company_id: string;
  source_uid: string;
  title: string;
  normalized_title: string | null;
  department: string | null;
  team: string | null;
  location_raw: string | null;
  locations: string[];
  is_remote: boolean;
  employment_type: string | null;
  experience_level: string | null;
  is_early_career: boolean;
  apply_url: string;
  description_snippet: string | null;
  description_html: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  posted_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  is_open: boolean;
  confidence: number;
  source: string;
  created_at: string;
  updated_at: string;
};

export type ProfileRow = {
  id: string;
  full_name: string | null;
  headline: string | null;
  location: string | null;
  phone: string | null;
  links: Record<string, string>;
  resume_url: string | null;
  resume_text: string | null;
  created_at: string;
  updated_at: string;
};

export type FetchRequestRow = {
  id: string;
  raw_query: string;
  normalized_query: string;
  requested_by: string | null;
  requester_ip: string | null;
  status: FetchStatus;
  resolved_company_id: string | null;
  message: string | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
};

export type WatchRow = {
  id: string;
  user_id: string;
  company_id: string;
  notify_email: boolean;
  last_seen_at: string;
  created_at: string;
};

export type ApplicationRow = {
  id: string;
  user_id: string;
  job_id: string | null;
  company_id: string | null;
  title: string;
  company_name: string | null;
  apply_url: string | null;
  stage: ApplicationStage;
  applied_at: string | null;
  notes: string | null;
  next_action: string | null;
  next_action_date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ScrapeRunRow = {
  id: string;
  company_id: string | null;
  adapter: string;
  status: RunStatus;
  jobs_found: number;
  jobs_added: number;
  jobs_closed: number;
  duration_ms: number | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
};

export type AlertQueueRow = {
  id: string;
  user_id: string;
  job_id: string;
  watch_id: string | null;
  created_at: string;
  sent_at: string | null;
};

export type PlatformStats = {
  companies: number;
  open_jobs: number;
  early_career_jobs: number;
  last_updated: string | null;
};

type TableDef<Row extends Record<string, unknown>> = {
  Row: Row;
  Insert: Partial<Row> & Record<string, unknown>;
  Update: Partial<Row> & Record<string, unknown>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      companies: TableDef<CompanyRow>;
      jobs: TableDef<JobRow>;
      profiles: TableDef<ProfileRow>;
      fetch_requests: TableDef<FetchRequestRow>;
      watches: TableDef<WatchRow>;
      applications: TableDef<ApplicationRow>;
      scrape_runs: TableDef<ScrapeRunRow>;
      alerts_queue: TableDef<AlertQueueRow>;
      ai_usage: TableDef<{ day: string; calls: number }>;
      request_log: TableDef<{
        id: number;
        ip: string | null;
        user_id: string | null;
        kind: string;
        created_at: string;
      }>;
    };
    Views: Record<string, never>;
    Functions: {
      search_companies: {
        Args: { q: string; lim?: number };
        Returns: Array<
          Pick<
            CompanyRow,
            | "id"
            | "name"
            | "slug"
            | "domain"
            | "logo_url"
            | "ats_type"
            | "tags"
            | "is_early_career_friendly"
            | "open_jobs_count"
          > & { score: number }
        >;
      };
      enqueue_fetch_request: {
        Args: { p_query: string; p_ip?: string | null; p_user?: string | null };
        Returns: string;
      };
      match_watches: { Args: { p_job_id: string }; Returns: number };
      increment_ai_usage: { Args: Record<string, never>; Returns: number };
      get_ai_usage: { Args: Record<string, never>; Returns: number };
      platform_stats: { Args: Record<string, never>; Returns: PlatformStats };
    };
    Enums: {
      company_status: CompanyStatus;
      ats_type: AtsType;
      fetch_status: FetchStatus;
      application_stage: ApplicationStage;
      run_status: RunStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};

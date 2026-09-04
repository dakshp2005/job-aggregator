import type { AtsType } from "@/lib/supabase/database.types";

/** Normalised-but-still-raw posting as returned by an ATS adapter. */
export interface RawJob {
  sourceUid: string;
  title: string;
  url: string;
  location?: string | null;
  locations?: string[];
  remote?: boolean;
  department?: string | null;
  team?: string | null;
  employmentType?: string | null;
  experienceLevel?: string | null;
  descriptionHtml?: string | null;
  descriptionText?: string | null;
  postedAt?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  /** 1.0 = structured feed, <1 = heuristic / AI extraction */
  confidence?: number;
}

export interface AdapterContext {
  /** advertised in the User-Agent header */
  contactUrl: string;
  /** per-host politeness delay, ms */
  minDelayMs: number;
  signal?: AbortSignal;
}

export interface Adapter {
  type: AtsType;
  label: string;
  /** Pull every live posting for `slug`. Throws on hard failure (404, network). */
  fetchJobs(slug: string, ctx: AdapterContext): Promise<RawJob[]>;
  /**
   * If `url` looks like this ATS, return the board slug embedded in it.
   * Used by company resolution to auto-detect the ATS from a careers link.
   */
  matchUrl(url: string): string | null;
}

export class AdapterError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AdapterError";
  }
}

import type { AtsType } from "@/lib/supabase/database.types";
import type { Adapter } from "./types";
import { greenhouseAdapter } from "./greenhouse";
import { leverAdapter } from "./lever";
import { ashbyAdapter } from "./ashby";
import { smartRecruitersAdapter } from "./smartrecruiters";
import { recruiteeAdapter } from "./recruitee";
import { personioAdapter } from "./personio";
import { workdayAdapter } from "./workday";
import { jsonLdAdapter } from "./jsonld";

export const ADAPTERS: Adapter[] = [
  greenhouseAdapter,
  leverAdapter,
  ashbyAdapter,
  smartRecruitersAdapter,
  recruiteeAdapter,
  personioAdapter,
  workdayAdapter,
  jsonLdAdapter,
];

const BY_TYPE = new Map<AtsType, Adapter>(ADAPTERS.map((a) => [a.type, a]));

export function getAdapter(type: AtsType): Adapter | null {
  return BY_TYPE.get(type) ?? null;
}

/**
 * Given any careers / job-board URL, detect which ATS it belongs to and the
 * board slug to use. Order matters — jsonld never matches here.
 */
export function detectAts(
  url: string,
): { atsType: AtsType; atsSlug: string } | null {
  for (const adapter of ADAPTERS) {
    const slug = adapter.matchUrl(url);
    if (slug) return { atsType: adapter.type, atsSlug: slug };
  }
  return null;
}

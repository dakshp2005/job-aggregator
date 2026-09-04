/**
 * Heuristics for tagging "early-career friendly" roles: internships, new-grad
 * programs, apprenticeships, and entry-level positions. Intentionally
 * conservative — false positives dilute the /companies "great for new grads"
 * filter more than false negatives hurt.
 */

const POSITIVE = [
  /\bintern(ship)?\b/i,
  /\bco[- ]?op\b/i,
  /\bnew[- ]?grad(uate)?\b/i,
  /\bgrad(uate)? (program|scheme|role|engineer|analyst|developer|hire)\b/i,
  /\bgraduate\b/i,
  /\bcampus\b/i,
  /\bapprentice(ship)?\b/i,
  /\bearly[- ]?career\b/i,
  /\bentry[- ]?level\b/i,
  /\bjunior\b/i,
  /\btrainee\b/i,
  /\b(university|college) (hire|recruit)/i,
  /\brotational (program|analyst)\b/i,
  /\b(swe|sde|engineer|analyst|scientist)\s*[i1]\b/i, // "Engineer I", "SWE 1"
  /\bfellow(ship)?\b/i,
  /\bworking student\b/i,
];

const NEGATIVE = [
  /\bsenior\b/i,
  /\bstaff\b/i,
  /\bprincipal\b/i,
  /\blead\b/i,
  /\bmanager\b/i,
  /\bdirector\b/i,
  /\bhead of\b/i,
  /\bvp\b/i,
  /\bexecutive\b/i,
  /\barchitect\b/i,
  /\b(sr|snr)\.?\b/i,
  /\b(ii|iii|iv|v|2|3|4|5)\b/, // Engineer II+, level 3+
  /\b\d+\+?\s*years?\b/i,
];

export interface EarlyCareerSignal {
  isEarlyCareer: boolean;
  experienceLevel: string | null;
  reason: string | null;
}

export function classifyEarlyCareer(
  title: string,
  descriptionText?: string | null,
  employmentType?: string | null,
  explicitLevel?: string | null,
): EarlyCareerSignal {
  const haystackTitle = ` ${title} `;
  const level = (explicitLevel ?? "").toLowerCase();

  if (/intern/.test(level) || /intern/i.test(employmentType ?? "")) {
    return { isEarlyCareer: true, experienceLevel: "intern", reason: "employment type" };
  }

  const negHitTitle = NEGATIVE.find((r) => r.test(haystackTitle));
  const posHitTitle = POSITIVE.find((r) => r.test(haystackTitle));

  if (posHitTitle && !negHitTitle) {
    const lvl = /intern|co[- ]?op|working student/i.test(title)
      ? "intern"
      : /new[- ]?grad|graduate|campus|university|college/i.test(title)
        ? "new-grad"
        : "entry";
    return { isEarlyCareer: true, experienceLevel: lvl, reason: `title: ${posHitTitle}` };
  }

  if (negHitTitle) {
    const lvl = /senior|sr|snr/i.test(title)
      ? "senior"
      : /staff|principal|architect/i.test(title)
        ? "staff+"
        : /manager|director|head of|vp|executive/i.test(title)
          ? "leadership"
          : "mid";
    return { isEarlyCareer: false, experienceLevel: lvl, reason: `title: ${negHitTitle}` };
  }

  // Fall back to the description for an explicit "entry level" / "0-2 years".
  const desc = (descriptionText ?? "").slice(0, 1500);
  if (/\b(0[-–]2|no prior|entry[- ]level|recent grad)/i.test(desc) && !/\b[3-9]\+?\s*years/i.test(desc)) {
    return { isEarlyCareer: true, experienceLevel: "entry", reason: "description" };
  }

  const known = ["intern", "entry", "mid", "senior", "lead", "principal", "staff"].find((k) =>
    level.includes(k),
  );
  return { isEarlyCareer: known === "intern" || known === "entry", experienceLevel: known ?? null, reason: null };
}

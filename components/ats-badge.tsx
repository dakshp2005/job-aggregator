import { Badge } from "@/components/ui/badge";
import type { AtsType } from "@/lib/supabase/database.types";

const LABELS: Record<AtsType, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  smartrecruiters: "SmartRecruiters",
  recruitee: "Recruitee",
  personio: "Personio",
  workday: "Workday",
  jsonld: "Careers page",
  unknown: "Unknown ATS",
};

export function AtsBadge({ type }: { type: AtsType }) {
  if (type === "unknown") return null;
  return (
    <Badge variant="secondary" className="font-normal">
      via {LABELS[type]}
    </Badge>
  );
}

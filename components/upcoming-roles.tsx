import { CalendarClock, Info } from "lucide-react";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Lightweight "when does this company usually post early-career roles?" view.
 * Derived purely from the posted_at distribution of early-career jobs we've
 * seen (open + recently closed). Not a prediction engine — a hint.
 */
export function UpcomingRoles({
  history,
  companyName,
}: {
  history: { posted_at: string | null; is_early_career: boolean }[];
  companyName: string;
}) {
  const ecDates = history
    .filter((h) => h.is_early_career && h.posted_at)
    .map((h) => new Date(h.posted_at as string));

  const counts = new Array(12).fill(0);
  for (const d of ecDates) if (!Number.isNaN(d.getTime())) counts[d.getMonth()]++;
  const max = Math.max(...counts, 1);
  const currentMonth = new Date().getMonth();
  const hotMonths = counts
    .map((c, i) => ({ i, c }))
    .filter((x) => x.c > 0)
    .sort((a, b) => b.c - a.c)
    .slice(0, 3)
    .map((x) => MONTHS[x.i]);

  if (ecDates.length < 3) {
    return (
      <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Not enough history yet to spot a hiring pattern for {companyName}. Watch the company and
          we&apos;ll email you the moment a new role opens.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <CalendarClock className="h-4 w-4" />
        Based on {ecDates.length} early-career postings we&apos;ve tracked,{" "}
        {companyName} most often opens them in{" "}
        <span className="font-medium text-foreground">{hotMonths.join(", ")}</span>.
      </p>
      <div className="grid grid-cols-12 gap-1">
        {counts.map((c, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="flex h-24 w-full items-end">
              <div
                className={`w-full rounded-t ${i === currentMonth ? "bg-primary" : "bg-primary/30"}`}
                style={{ height: `${(c / max) * 100}%`, minHeight: c > 0 ? 4 : 0 }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">{MONTHS[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

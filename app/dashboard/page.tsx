import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, ExternalLink, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CompanyLogo } from "@/components/company-logo";
import { MarkSeenButton } from "@/components/mark-seen-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard");

  const { data: watches } = await supabase
    .from("watches")
    .select("id, last_seen_at, company:companies(id, name, slug, domain, open_jobs_count, last_scraped_at)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const watchList = (watches ?? []) as any[];

  // New roles since each watch's last_seen_at.
  const companyIds = watchList.map((w) => w.company?.id).filter(Boolean);
  const seenMap = new Map(watchList.map((w) => [w.company?.id, w.last_seen_at]));

  let newJobs: any[] = [];
  if (companyIds.length) {
    const { data } = await supabase
      .from("jobs")
      .select("id, title, apply_url, first_seen_at, is_early_career, company_id, companies(name, slug)")
      .in("company_id", companyIds)
      .eq("is_open", true)
      .order("first_seen_at", { ascending: false })
      .limit(100);
    newJobs = (data ?? []).filter(
      (j) => seenMap.get(j.company_id) && new Date(j.first_seen_at) > new Date(seenMap.get(j.company_id)),
    );
  }

  return (
    <div className="container max-w-4xl py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Your dashboard</h1>
        {newJobs.length > 0 && <MarkSeenButton />}
      </div>

      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="h-4 w-4" /> New since your last visit
          {newJobs.length > 0 && <Badge variant="success">{newJobs.length}</Badge>}
        </h2>
        {newJobs.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Nothing new in your watched companies. We&apos;ll email you when that changes.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {newJobs.map((j) => (
              <Card key={j.id} className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {j.is_early_career && "🎓 "}
                      {j.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <Link href={`/company/${j.companies?.slug}`} className="hover:underline">
                        {j.companies?.name}
                      </Link>{" "}
                      · added {timeAgo(j.first_seen_at)}
                    </p>
                  </div>
                  <a
                    href={j.apply_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs hover:bg-accent"
                  >
                    Apply <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Bell className="h-4 w-4" /> Watching ({watchList.length})
        </h2>
        {watchList.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            You&apos;re not watching any companies yet.{" "}
            <Link href="/companies" className="underline">
              Browse companies
            </Link>{" "}
            and hit &ldquo;Watch&rdquo;.
          </p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {watchList.map((w) => (
              <Link key={w.id} href={`/company/${w.company?.slug}`}>
                <Card className="p-3 transition hover:border-primary/40">
                  <div className="flex items-center gap-3">
                    <CompanyLogo domain={w.company?.domain} name={w.company?.name ?? ""} size={40} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{w.company?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {w.company?.open_jobs_count} open · updated{" "}
                        {timeAgo(w.company?.last_scraped_at)}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

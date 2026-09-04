import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCompanyBySlug, getCompanyJobs } from "@/lib/data";
import { CompanyHeader } from "@/components/company-header";
import { JobsTable } from "@/components/jobs-table";
import { UpcomingRoles } from "@/components/upcoming-roles";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const revalidate = 120;

const ATS_LABELS: Record<string, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  smartrecruiters: "SmartRecruiters",
  recruitee: "Recruitee",
  personio: "Personio",
  workday: "Workday",
  jsonld: "the careers site",
  unknown: "the careers site",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) return { title: "Company not found" };
  return {
    title: `${company.name} — ${company.open_jobs_count} open roles`,
    description: `Every open job at ${company.name}, with direct application links.`,
  };
}

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [jobs, historyRes, watchRes, profileRes] = await Promise.all([
    getCompanyJobs(company.id, { onlyOpen: true }),
    supabase
      .from("jobs")
      .select("posted_at, is_early_career")
      .eq("company_id", company.id)
      .limit(1000),
    user
      ? supabase
          .from("watches")
          .select("id")
          .eq("company_id", company.id)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const atsLabel = ATS_LABELS[company.ats_type] ?? "the careers site";

  return (
    <div className="container max-w-5xl py-10">
      <CompanyHeader company={company} watched={!!watchRes.data} isAuthed={!!user} />

      <Tabs defaultValue="open" className="mt-8">
        <TabsList>
          <TabsTrigger value="open">Open roles ({jobs.length})</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="mt-6">
          {jobs.length === 0 ? (
            <div className="rounded-lg border bg-muted/30 p-8 text-center text-muted-foreground">
              No open roles right now. Watch {company.name} to get alerted when that changes.
            </div>
          ) : (
            <JobsTable
              jobs={jobs}
              companyName={company.name}
              atsLabel={atsLabel}
              profile={profileRes.data ?? null}
              isAuthed={!!user}
            />
          )}
        </TabsContent>

        <TabsContent value="upcoming" className="mt-6">
          <UpcomingRoles history={historyRes.data ?? []} companyName={company.name} />
        </TabsContent>

        <TabsContent value="about" className="mt-6 space-y-4 text-sm">
          {company.description && <p className="max-w-2xl">{company.description}</p>}
          <dl className="grid gap-2 sm:grid-cols-2">
            <Row label="Website" value={company.domain} href={company.domain ? `https://${company.domain}` : undefined} />
            <Row label="Careers page" value={company.careers_url} href={company.careers_url ?? undefined} />
            <Row label="Applicant tracking system" value={ATS_LABELS[company.ats_type] ?? company.ats_type} />
            <Row label="HQ" value={company.hq_country} />
            <Row label="How we found it" value={company.source === "on-demand" ? "Fetched on demand" : "Seeded"} />
          </dl>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ label, value, href }: { label: string; value?: string | null; href?: string }) {
  if (!value) return null;
  return (
    <div className="flex flex-col rounded-lg border p-3">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate">
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="hover:underline">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

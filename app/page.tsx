import Link from "next/link";
import { ArrowRight, GraduationCap, Sparkles, Zap } from "lucide-react";
import { SearchCommand } from "@/components/search-command";
import { CompanyCard } from "@/components/company-card";
import { Badge } from "@/components/ui/badge";
import {
  getPlatformStats,
  getTrendingCompanies,
  getRecentlyAdded,
  getEarlyCareerCompanies,
} from "@/lib/data";
import { timeAgo } from "@/lib/utils";

export const revalidate = 300;

export default async function HomePage() {
  const [stats, trending, recent, earlyCareer] = await Promise.all([
    getPlatformStats(),
    getTrendingCompanies(8),
    getRecentlyAdded(8),
    getEarlyCareerCompanies(8),
  ]);

  return (
    <div className="container py-12">
      <section className="mx-auto max-w-2xl text-center">
        <Badge variant="secondary" className="mb-4 gap-1 font-normal">
          <Sparkles className="h-3 w-3" /> Self-growing job index
        </Badge>
        <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          Every company&apos;s open roles, in one place
        </h1>
        <p className="mt-4 text-pretty text-lg text-muted-foreground">
          Search a company and see all its open jobs and interview openings, each with a direct
          link to the real application form. Not indexed yet? Our AI fetches it live.
        </p>

        <div className="mx-auto mt-8 max-w-xl">
          <SearchCommand variant="hero" />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <span>
            <strong className="text-foreground">{stats.companies.toLocaleString()}</strong> companies
          </span>
          <span>
            <strong className="text-foreground">{stats.open_jobs.toLocaleString()}</strong> open roles
          </span>
          <span>
            <strong className="text-foreground">
              {stats.early_career_jobs.toLocaleString()}
            </strong>{" "}
            early-career
          </span>
          {stats.last_updated && <span>updated {timeAgo(stats.last_updated)}</span>}
        </div>
      </section>

      <Section
        title="Trending right now"
        subtitle="Companies with the most open roles"
        href="/companies"
        companies={trending}
        icon={<Zap className="h-4 w-4" />}
      />

      <Section
        title="Great for new grads"
        subtitle="Strong internship & early-career hiring"
        href="/companies?tag=early-career"
        companies={earlyCareer}
        icon={<GraduationCap className="h-4 w-4" />}
      />

      <Section
        title="Recently added"
        subtitle="Fetched on demand by people like you"
        href="/companies"
        companies={recent}
        icon={<Sparkles className="h-4 w-4" />}
      />
    </div>
  );
}

function Section({
  title,
  subtitle,
  href,
  companies,
  icon,
}: {
  title: string;
  subtitle: string;
  href: string;
  companies: Awaited<ReturnType<typeof getTrendingCompanies>>;
  icon: React.ReactNode;
}) {
  if (companies.length === 0) return null;
  return (
    <section className="mt-14">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            {icon} {title}
          </h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          Browse all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {companies.map((c) => (
          <CompanyCard key={c.id} company={c} />
        ))}
      </div>
    </section>
  );
}

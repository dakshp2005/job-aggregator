import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { listCompanies } from "@/lib/data";
import { CompanyCard } from "@/components/company-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const revalidate = 300;

export const metadata = { title: "Browse companies" };

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; ats?: string; country?: string; page?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page ?? 1);
  const earlyCareer = sp.tag === "early-career";

  const { companies, total, pageSize } = await listCompanies({
    tag: sp.tag,
    ats: sp.ats,
    country: sp.country,
    q: sp.q,
    earlyCareer,
    page,
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const mkHref = (p: number) => {
    const params = new URLSearchParams();
    if (sp.tag) params.set("tag", sp.tag);
    if (sp.ats) params.set("ats", sp.ats);
    if (sp.country) params.set("country", sp.country);
    if (sp.q) params.set("q", sp.q);
    params.set("page", String(p));
    return `/companies?${params.toString()}`;
  };

  return (
    <div className="container py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {earlyCareer ? "Companies great for new grads" : "All companies"}
          </h1>
          <p className="text-sm text-muted-foreground">{total.toLocaleString()} indexed</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant={!sp.tag ? "default" : "outline"} size="sm">
            <Link href="/companies">All</Link>
          </Button>
          <Button asChild variant={earlyCareer ? "default" : "outline"} size="sm" className="gap-1">
            <Link href="/companies?tag=early-career">
              <GraduationCap className="h-4 w-4" /> New grad
            </Link>
          </Button>
        </div>
      </div>

      {companies.length === 0 ? (
        <p className="mt-10 text-muted-foreground">
          Nothing here yet. Try searching a company to fetch it.
        </p>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {companies.map((c) => (
            <CompanyCard key={c.id} company={c} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <Button asChild variant="outline" size="sm" disabled={page <= 1}>
            <Link href={mkHref(Math.max(1, page - 1))}>Previous</Link>
          </Button>
          <Badge variant="outline" className="font-normal">
            {page} / {totalPages}
          </Badge>
          <Button asChild variant="outline" size="sm" disabled={page >= totalPages}>
            <Link href={mkHref(Math.min(totalPages, page + 1))}>Next</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

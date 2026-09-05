import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CompanyCard } from "@/components/company-card";
import { FetchCompanyFlow } from "@/components/fetch-company-flow";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; fetch?: string }>;
}) {
  const { q = "", fetch: fetchParam } = await searchParams;
  const query = q.trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/search?q=${query}`)}`);

  const { data: hits } = query
    ? await supabase.rpc("search_companies", { q: query, lim: 24 })
    : { data: [] };

  const results = hits ?? [];
  const forceFetch = fetchParam === "1";

  return (
    <div className="container max-w-5xl py-10">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Home
      </Link>

      <h1 className="text-2xl font-bold tracking-tight">
        {query ? <>Results for &ldquo;{query}&rdquo;</> : "Search"}
      </h1>

      {results.length > 0 && !forceFetch && (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            {results.length} matching {results.length === 1 ? "company" : "companies"}
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((c: any) => (
              <CompanyCard key={c.id} company={c} />
            ))}
          </div>
          <div className="mt-10 border-t pt-8">
            <p className="mb-4 text-center text-sm text-muted-foreground">
              Not the company you meant?
            </p>
            <FetchCompanyFlow query={query} />
          </div>
        </>
      )}

      {(results.length === 0 || forceFetch) && query && (
        <div className="mt-8">
          <FetchCompanyFlow query={query} autoStart={forceFetch || results.length === 0} />
        </div>
      )}

      {!query && (
        <p className="mt-6 text-muted-foreground">
          Use the search box in the header (or press ⌘K) to find a company.
        </p>
      )}
    </div>
  );
}

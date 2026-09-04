import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { timeAgo } from "@/lib/utils";

export const revalidate = 120;
export const metadata = { title: "Data freshness" };

export default async function TransparencyPage() {
  const supabase = await createClient();
  const { data: runs } = await supabase
    .from("scrape_runs")
    .select("id, adapter, status, jobs_found, jobs_added, jobs_closed, duration_ms, started_at, company_id, companies(name, slug)")
    .order("started_at", { ascending: false })
    .limit(100);

  return (
    <div className="container max-w-4xl py-10">
      <h1 className="text-2xl font-bold tracking-tight">Data freshness</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every scrape run, warts and all. We pull from official ATS feeds where possible and fall
        back to careers-page parsing + AI extraction.
      </p>

      <div className="mt-6 rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Result</TableHead>
              <TableHead className="text-right">Found</TableHead>
              <TableHead className="text-right">+/−</TableHead>
              <TableHead className="text-right">When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(runs ?? []).map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">
                  {r.companies?.slug ? (
                    <Link href={`/company/${r.companies.slug}`} className="hover:underline">
                      {r.companies.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{r.adapter}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      r.status === "ok" ? "success" : r.status === "error" ? "destructive" : "secondary"
                    }
                    className="font-normal"
                  >
                    {r.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.jobs_found}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  +{r.jobs_added} / −{r.jobs_closed}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {timeAgo(r.started_at)}
                </TableCell>
              </TableRow>
            ))}
            {(!runs || runs.length === 0) && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No scrape runs yet. Run the ingester to populate this.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

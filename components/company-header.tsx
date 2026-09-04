import { ExternalLink, Globe, RefreshCw } from "lucide-react";
import { CompanyLogo } from "@/components/company-logo";
import { AtsBadge } from "@/components/ats-badge";
import { Badge } from "@/components/ui/badge";
import { WatchButton } from "@/components/watch-button";
import { timeAgo } from "@/lib/utils";
import type { CompanyRow } from "@/lib/supabase/database.types";

export function CompanyHeader({
  company,
  watched,
  isAuthed,
}: {
  company: CompanyRow;
  watched: boolean;
  isAuthed: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex gap-4">
        <CompanyLogo domain={company.domain} name={company.name} size={64} />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{company.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {company.domain && (
              <a
                href={`https://${company.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <Globe className="h-3.5 w-3.5" /> {company.domain}
              </a>
            )}
            <AtsBadge type={company.ats_type} />
            {company.hq_country && <span>· {company.hq_country}</span>}
          </div>
          {company.description && (
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{company.description}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {company.is_early_career_friendly && (
              <Badge variant="success" className="font-normal">
                Great for new grads
              </Badge>
            )}
            {company.tags
              .filter((t) => t !== "early-career")
              .map((t) => (
                <Badge key={t} variant="outline" className="font-normal">
                  {t}
                </Badge>
              ))}
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <RefreshCw className="h-3 w-3" /> updated {timeAgo(company.last_scraped_at)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <WatchButton companyId={company.id} initialWatched={watched} isAuthed={isAuthed} />
        {company.careers_url && (
          <a
            href={company.careers_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-1.5 rounded-md border px-3 text-sm hover:bg-accent"
          >
            Careers site <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

"use client";

import Link, { useLinkStatus } from "next/link";
import { GraduationCap, MapPin, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CompanyLogo } from "@/components/company-logo";
import { useAuth } from "@/components/auth-provider";

export interface CompanyCardData {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  tags: string[];
  is_early_career_friendly: boolean;
  open_jobs_count: number;
  hq_country?: string | null;
}

function PendingOverlay() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/60">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function CardBody({
  company,
  otherTags,
  showPendingOverlay,
}: {
  company: CompanyCardData;
  otherTags: string[];
  showPendingOverlay?: boolean;
}) {
  return (
    <Card className="relative h-full p-4 transition hover:border-primary/40 hover:shadow-md">
      {showPendingOverlay && <PendingOverlay />}
      <div className="flex items-start gap-3">
        <CompanyLogo domain={company.domain} name={company.name} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold">{company.name}</h3>
            {company.is_early_career_friendly && (
              <GraduationCap className="h-4 w-4 shrink-0 text-emerald-600" />
            )}
          </div>
          {company.hq_country && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" /> {company.hq_country}
            </p>
          )}
          <p className="mt-2 text-sm">
            <span className="font-medium">{company.open_jobs_count}</span>{" "}
            <span className="text-muted-foreground">
              open role{company.open_jobs_count === 1 ? "" : "s"}
            </span>
          </p>
        </div>
      </div>
      {otherTags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {otherTags.slice(0, 3).map((t) => (
            <Badge key={t} variant="outline" className="font-normal">
              {t}
            </Badge>
          ))}
        </div>
      )}
    </Card>
  );
}

export function CompanyCard({ company }: { company: CompanyCardData }) {
  const { user, requireAuth } = useAuth();
  const otherTags = (company.tags ?? []).filter((t) => t !== "early-career");

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => requireAuth(`Sign in to see ${company.name}'s open roles.`)}
        className="block w-full text-left"
      >
        <CardBody company={company} otherTags={otherTags} />
      </button>
    );
  }

  return (
    <Link href={`/company/${company.slug}`} className="block">
      <CardBody company={company} otherTags={otherTags} showPendingOverlay />
    </Link>
  );
}

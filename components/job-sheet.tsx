"use client";

import { ExternalLink, MapPin, CalendarDays, Banknote, Building2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CopyProfileButton } from "@/components/copy-profile-button";
import { SaveToTrackerButton } from "@/components/save-to-tracker-button";
import { formatSalary, timeAgo } from "@/lib/utils";
import type { JobRow, ProfileRow } from "@/lib/supabase/database.types";

export function JobSheet({
  job,
  companyName,
  atsLabel,
  profile,
  isAuthed,
  open,
  onOpenChange,
}: {
  job: JobRow | null;
  companyName: string;
  atsLabel: string;
  profile: ProfileRow | null;
  isAuthed: boolean;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  if (!job) return null;
  const salary = formatSalary(job.salary_min, job.salary_max, job.salary_currency);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="pr-6 text-left text-xl">{job.title}</SheetTitle>
          <SheetDescription className="text-left">
            <span className="inline-flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" /> {companyName}
            </span>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex flex-wrap gap-2">
          {job.is_early_career && <Badge variant="success">Early career</Badge>}
          {job.is_remote && <Badge variant="secondary">Remote</Badge>}
          {job.department && <Badge variant="outline">{job.department}</Badge>}
          {job.employment_type && (
            <Badge variant="outline">{job.employment_type.replace(/_/g, " ")}</Badge>
          )}
        </div>

        <dl className="mt-4 space-y-2 text-sm">
          {(job.locations.length > 0 || job.location_raw) && (
            <div className="flex gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <dd>{job.locations.length ? job.locations.join(" · ") : job.location_raw}</dd>
            </div>
          )}
          {salary && (
            <div className="flex gap-2">
              <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <dd>{salary}</dd>
            </div>
          )}
          {job.posted_at && (
            <div className="flex gap-2">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <dd>Posted {timeAgo(job.posted_at)}</dd>
            </div>
          )}
        </dl>

        <Separator className="my-4" />

        <div className="flex flex-col gap-2">
          <Button asChild className="w-full gap-2">
            <a href={job.apply_url} target="_blank" rel="noopener noreferrer">
              Apply on {atsLabel} <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <SaveToTrackerButton job={job} companyName={companyName} isAuthed={isAuthed} />
            <CopyProfileButton profile={profile} />
          </div>
        </div>

        {job.description_snippet && (
          <>
            <Separator className="my-4" />
            <div className="prose prose-sm max-w-none text-sm text-muted-foreground">
              <h4 className="mb-1 font-medium text-foreground">About the role</h4>
              <p className="whitespace-pre-wrap">{job.description_snippet}</p>
              {job.confidence < 1 && (
                <p className="mt-3 text-xs italic">
                  This posting was extracted automatically and may be incomplete — check the
                  original listing before applying.
                </p>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BookmarkCheck, BookmarkPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { JobRow } from "@/lib/supabase/database.types";

export function SaveToTrackerButton({
  job,
  companyName,
  isAuthed,
}: {
  job: JobRow;
  companyName: string;
  isAuthed: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const save = async () => {
    if (!isAuthed) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/application", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jobId: job.id,
          companyId: job.company_id,
          title: job.title,
          companyName,
          applyUrl: job.apply_url,
          stage: "saved",
        }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      toast.success("Saved to your tracker.", {
        action: { label: "Open tracker", onClick: () => router.push("/tracker") },
      });
    } catch {
      toast.error("Couldn't save. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" className="gap-2" onClick={save} disabled={loading || saved}>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : saved ? (
        <BookmarkCheck className="h-4 w-4" />
      ) : (
        <BookmarkPlus className="h-4 w-4" />
      )}
      {saved ? "Saved" : "Save to tracker"}
    </Button>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function WatchButton({
  companyId,
  initialWatched,
  isAuthed,
}: {
  companyId: string;
  initialWatched: boolean;
  isAuthed: boolean;
}) {
  const router = useRouter();
  const [watched, setWatched] = React.useState(initialWatched);
  const [loading, setLoading] = React.useState(false);

  const toggle = async () => {
    if (!isAuthed) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setLoading(true);
    const nextState = !watched;
    try {
      const res = await fetch("/api/watch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ companyId, watched: nextState }),
      });
      if (!res.ok) throw new Error();
      setWatched(nextState);
      toast.success(nextState ? "Watching — you'll get alerts for new roles." : "Stopped watching.");
    } catch {
      toast.error("Couldn't update your watch. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant={watched ? "secondary" : "outline"} onClick={toggle} disabled={loading} className="gap-2">
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : watched ? (
        <BellRing className="h-4 w-4" />
      ) : (
        <Bell className="h-4 w-4" />
      )}
      {watched ? "Watching" : "Watch"}
    </Button>
  );
}

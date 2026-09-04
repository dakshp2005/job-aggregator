"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MarkSeenButton() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        await fetch("/api/watch", { method: "PATCH" });
        router.refresh();
        setLoading(false);
      }}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      Mark all seen
    </Button>
  );
}

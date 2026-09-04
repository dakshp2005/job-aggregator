"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, CheckCircle2, XCircle, Search, Globe, FileSearch } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const STEPS = [
  { key: "resolving", label: "Finding the company & careers page", icon: Search },
  { key: "scraping", label: "Reading open roles", icon: Globe },
  { key: "extracting", label: "Extracting with AI", icon: FileSearch },
  { key: "done", label: "Done", icon: CheckCircle2 },
] as const;

type Status = "idle" | "pending" | "resolving" | "scraping" | "extracting" | "done" | "failed";

export function FetchCompanyFlow({ query, autoStart = false }: { query: string; autoStart?: boolean }) {
  const router = useRouter();
  const [status, setStatus] = React.useState<Status>("idle");
  const [message, setMessage] = React.useState<string>("");
  const [error, setError] = React.useState<string | null>(null);
  const started = React.useRef(false);

  const start = React.useCallback(async () => {
    if (started.current) return;
    started.current = true;
    setStatus("pending");
    setError(null);
    setMessage("Queued…");

    try {
      const res = await fetch("/api/fetch-company", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("failed");
        setError(data.error ?? "Couldn't start the fetch.");
        return;
      }
      if (data.status === "done" && data.slug) {
        router.push(`/company/${data.slug}`);
        return;
      }

      const requestId: string = data.requestId;
      const poll = setInterval(async () => {
        try {
          const s = await fetch(`/api/fetch-company/status?id=${requestId}`, { cache: "no-store" });
          const sd = await s.json();
          setStatus(sd.status);
          setMessage(sd.message ?? "");
          if (sd.done) {
            clearInterval(poll);
            if (sd.status === "done" && sd.slug) {
              setTimeout(() => router.push(`/company/${sd.slug}`), 700);
            } else if (sd.status === "failed") {
              setError(sd.error || sd.message || "The fetch failed.");
            }
          }
        } catch {
          /* keep polling */
        }
      }, 2000);
      // safety stop after 4 minutes
      setTimeout(() => clearInterval(poll), 240_000);
    } catch {
      setStatus("failed");
      setError("Network error — please try again.");
    }
  }, [query, router]);

  React.useEffect(() => {
    if (autoStart) start();
  }, [autoStart, start]);

  const activeIndex = STEPS.findIndex((s) => s.key === status);

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          {status === "idle"
            ? `“${query}” isn't in our index yet`
            : status === "failed"
              ? "Couldn't fetch that one"
              : status === "done"
                ? "Added!"
                : "Fetching live…"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === "idle" && (
          <>
            <p className="text-sm text-muted-foreground">
              We&apos;ll send an AI agent to the company&apos;s own careers page, pull its open
              roles, and add it permanently. Takes about 20–40 seconds.
            </p>
            <Button className="w-full gap-2" onClick={start}>
              <Sparkles className="h-4 w-4" /> Fetch it now
            </Button>
          </>
        )}

        {(status === "pending" ||
          status === "resolving" ||
          status === "scraping" ||
          status === "extracting" ||
          status === "done") && (
          <ol className="space-y-3">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              const state =
                status === "done" || i < activeIndex
                  ? "done"
                  : i === activeIndex
                    ? "active"
                    : "todo";
              return (
                <li key={step.key} className="flex items-center gap-3 text-sm">
                  <span
                    className={
                      state === "done"
                        ? "text-emerald-600"
                        : state === "active"
                          ? "text-primary"
                          : "text-muted-foreground/40"
                    }
                  >
                    {state === "active" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : state === "done" ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </span>
                  <span className={state === "todo" ? "text-muted-foreground/50" : ""}>
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {message && status !== "failed" && status !== "idle" && (
          <p className="text-xs text-muted-foreground">{message}</p>
        )}

        {status === "failed" && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-sm text-destructive">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                started.current = false;
                start();
              }}
            >
              Try again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

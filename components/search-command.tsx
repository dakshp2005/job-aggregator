"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Building2, Sparkles } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Hit {
  slug: string;
  name: string;
  domain: string | null;
  open_jobs_count: number;
  is_early_career_friendly: boolean;
}

export function SearchCommand({
  variant = "button",
  className,
  signedIn = true,
}: {
  variant?: "button" | "hero";
  className?: string;
  signedIn?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<Hit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const debounced = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "/") {
        if (e.key === "/" && /input|textarea/i.test((e.target as HTMLElement)?.tagName)) return;
        e.preventDefault();
        if (!signedIn) {
          router.push("/login?next=/search");
          return;
        }
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [signedIn, router]);

  React.useEffect(() => {
    if (!open) return;
    clearTimeout(debounced.current);
    if (query.trim().length < 2) {
      setHits([]);
      return;
    }
    setLoading(true);
    debounced.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setHits(data.companies ?? []);
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 220);
  }, [query, open]);

  const go = (path: string) => {
    setOpen(false);
    setQuery("");
    router.push(path);
  };

  const openOrSignIn = () => {
    if (!signedIn) {
      router.push("/login?next=/search");
      return;
    }
    setOpen(true);
  };

  return (
    <>
      {variant === "hero" ? (
        <button
          onClick={openOrSignIn}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl border bg-background px-5 py-4 text-left text-muted-foreground shadow-sm transition hover:border-primary/40 hover:shadow",
            className,
          )}
        >
          <Search className="h-5 w-5" />
          <span className="flex-1 text-base">
            {signedIn ? "Search any company…" : "Sign in to search…"}
          </span>
          <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-xs sm:inline">
            ⌘K
          </kbd>
        </button>
      ) : (
        <Button
          variant="outline"
          onClick={openOrSignIn}
          className={cn("gap-2 text-muted-foreground", className)}
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">
            {signedIn ? "Search companies" : "Sign in to search"}
          </span>
          <kbd className="ml-2 hidden rounded border bg-muted px-1.5 text-xs sm:inline">
            ⌘K
          </kbd>
        </Button>
      )}

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search a company — e.g. Stripe, Notion, Ramp…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {loading && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching…
            </div>
          )}

          {!loading && query.trim().length >= 2 && hits.length === 0 && (
            <CommandEmpty>
              <div className="space-y-3 py-2">
                <p className="text-sm text-muted-foreground">
                  No match for &ldquo;{query}&rdquo; in our index yet.
                </p>
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={() => go(`/search?q=${encodeURIComponent(query)}&fetch=1`)}
                >
                  <Sparkles className="h-4 w-4" />
                  Fetch this company now
                </Button>
              </div>
            </CommandEmpty>
          )}

          {hits.length > 0 && (
            <CommandGroup heading="Companies">
              {hits.map((h) => (
                <CommandItem
                  key={h.slug}
                  value={h.name}
                  onSelect={() => go(`/company/${h.slug}`)}
                  className="gap-3"
                >
                  {h.domain ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${h.domain}&sz=64`}
                      alt=""
                      className="h-5 w-5 rounded"
                    />
                  ) : (
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  )}
                  <span className="flex-1 truncate">{h.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {h.open_jobs_count} open
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}

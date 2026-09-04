"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, ExternalLink, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ApplicationDialog, STAGES } from "@/components/application-dialog";
import type { ApplicationRow, ApplicationStage } from "@/lib/supabase/database.types";

export function TrackerBoard({ applications }: { applications: ApplicationRow[] }) {
  const router = useRouter();
  const [items, setItems] = React.useState(applications);

  React.useEffect(() => setItems(applications), [applications]);

  const move = async (app: ApplicationRow, stage: ApplicationStage) => {
    setItems((prev) => prev.map((a) => (a.id === app.id ? { ...a, stage } : a)));
    try {
      const res = await fetch("/api/application", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: app.id, stage }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("Couldn't move that card.");
      router.refresh();
    }
  };

  const remove = async (id: string) => {
    setItems((prev) => prev.filter((a) => a.id !== id));
    await fetch(`/api/application?id=${id}`, { method: "DELETE" });
    toast.success("Removed.");
  };

  const byStage = (s: ApplicationStage) => items.filter((a) => a.stage === s);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
      {STAGES.map((col) => {
        const cards = byStage(col.value);
        return (
          <div key={col.value} className="w-72 shrink-0">
            <div className="mb-2 flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold">{col.label}</h3>
              <Badge variant="secondary" className="font-normal">
                {cards.length}
              </Badge>
            </div>
            <div className="space-y-2">
              {cards.map((app) => (
                <Card key={app.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{app.title}</p>
                      {app.company_name && (
                        <p className="truncate text-xs text-muted-foreground">{app.company_name}</p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <ApplicationDialog
                          application={app}
                          trigger={
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                              <Pencil className="h-4 w-4" /> Edit
                            </DropdownMenuItem>
                          }
                        />
                        {app.apply_url && (
                          <DropdownMenuItem asChild>
                            <a href={app.apply_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" /> Open posting
                            </a>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => remove(app.id)}
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {app.next_action && (
                    <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarClock className="h-3 w-3" />
                      {app.next_action}
                      {app.next_action_date && ` · ${app.next_action_date}`}
                    </p>
                  )}
                  {app.notes && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{app.notes}</p>
                  )}

                  <div className="mt-2 flex flex-wrap gap-1">
                    {STAGES.filter((s) => s.value !== app.stage)
                      .slice(0, 3)
                      .map((s) => (
                        <button
                          key={s.value}
                          onClick={() => move(app, s.value)}
                          className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent"
                        >
                          → {s.label}
                        </button>
                      ))}
                  </div>
                </Card>
              ))}
              {cards.length === 0 && (
                <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                  Empty
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

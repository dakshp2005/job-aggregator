"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ApplicationRow, ApplicationStage } from "@/lib/supabase/database.types";

export const STAGES: { value: ApplicationStage; label: string }[] = [
  { value: "saved", label: "Saved" },
  { value: "applied", label: "Applied" },
  { value: "phone_screen", label: "Phone screen" },
  { value: "onsite", label: "Onsite / final" },
  { value: "offer", label: "Offer" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
];

export function ApplicationDialog({
  application,
  trigger,
}: {
  application?: ApplicationRow;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const editing = !!application;

  const [form, setForm] = React.useState({
    title: application?.title ?? "",
    companyName: application?.company_name ?? "",
    applyUrl: application?.apply_url ?? "",
    stage: (application?.stage ?? "saved") as ApplicationStage,
    notes: application?.notes ?? "",
    nextAction: application?.next_action ?? "",
    nextActionDate: application?.next_action_date ?? "",
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/application", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          editing
            ? {
                id: application!.id,
                title: form.title,
                stage: form.stage,
                notes: form.notes,
                next_action: form.nextAction,
                next_action_date: form.nextActionDate || null,
              }
            : {
                title: form.title,
                companyName: form.companyName,
                applyUrl: form.applyUrl,
                stage: form.stage,
                notes: form.notes,
                nextAction: form.nextAction,
                nextActionDate: form.nextActionDate || null,
              },
        ),
      });
      if (!res.ok) throw new Error();
      toast.success(editing ? "Updated." : "Added to tracker.");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Couldn't save. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit application" : "Add application"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="title">Role title</Label>
            <Input id="title" value={form.title} onChange={(e) => set("title", e.target.value)} required />
          </div>
          {!editing && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  value={form.companyName}
                  onChange={(e) => set("companyName", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="url">Application URL</Label>
                <Input id="url" value={form.applyUrl} onChange={(e) => set("applyUrl", e.target.value)} />
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Stage</Label>
              <Select value={form.stage} onValueChange={(v) => set("stage", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nad">Next action date</Label>
              <Input
                id="nad"
                type="date"
                value={form.nextActionDate ?? ""}
                onChange={(e) => set("nextActionDate", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="na">Next action</Label>
            <Input
              id="na"
              placeholder="e.g. Follow up with recruiter"
              value={form.nextAction}
              onChange={(e) => set("nextAction", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading} className="gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

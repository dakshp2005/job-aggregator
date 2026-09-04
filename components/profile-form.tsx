"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ResumeUpload } from "@/components/resume-upload";
import type { ProfileRow } from "@/lib/supabase/database.types";

export function ProfileForm({
  userId,
  profile,
}: {
  userId: string;
  profile: ProfileRow | null;
}) {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [saving, setSaving] = React.useState(false);
  const links = (profile?.links ?? {}) as Record<string, string>;

  const [form, setForm] = React.useState({
    full_name: profile?.full_name ?? "",
    headline: profile?.headline ?? "",
    location: profile?.location ?? "",
    phone: profile?.phone ?? "",
    linkedin: links.linkedin ?? "",
    github: links.github ?? "",
    portfolio: links.portfolio ?? "",
    resume_text: profile?.resume_text ?? "",
    resume_url: profile?.resume_url ?? null,
  });
  const set = (k: keyof typeof form, v: string | null) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      full_name: form.full_name || null,
      headline: form.headline || null,
      location: form.location || null,
      phone: form.phone || null,
      links: {
        linkedin: form.linkedin || "",
        github: form.github || "",
        portfolio: form.portfolio || "",
      },
      resume_text: form.resume_text || null,
      resume_url: form.resume_url,
    });
    setSaving(false);
    if (error) {
      toast.error(`Couldn't save: ${error.message}`);
      return;
    }
    toast.success("Profile saved.");
    router.refresh();
  };

  return (
    <form onSubmit={save} className="max-w-xl space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name">
          <Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
        </Field>
        <Field label="Headline">
          <Input
            placeholder="Final-year CS student · SWE intern"
            value={form.headline}
            onChange={(e) => set("headline", e.target.value)}
          />
        </Field>
        <Field label="Location">
          <Input value={form.location} onChange={(e) => set("location", e.target.value)} />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="LinkedIn">
          <Input value={form.linkedin} onChange={(e) => set("linkedin", e.target.value)} />
        </Field>
        <Field label="GitHub">
          <Input value={form.github} onChange={(e) => set("github", e.target.value)} />
        </Field>
        <Field label="Portfolio / website">
          <Input value={form.portfolio} onChange={(e) => set("portfolio", e.target.value)} />
        </Field>
      </div>

      <div className="space-y-2">
        <Label>Résumé file</Label>
        <ResumeUpload
          userId={userId}
          initialPath={form.resume_url}
          onChange={(p) => set("resume_url", p)}
        />
        <p className="text-xs text-muted-foreground">
          Stored privately. Only you can download it.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="rt">Résumé text (for quick copy-paste into forms)</Label>
        <Textarea
          id="rt"
          rows={10}
          value={form.resume_text}
          onChange={(e) => set("resume_text", e.target.value)}
          placeholder="Paste your plain-text résumé here…"
        />
      </div>

      <Button type="submit" disabled={saving} className="gap-2">
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Save profile
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

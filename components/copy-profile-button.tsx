"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, ClipboardCopy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ProfileRow } from "@/lib/supabase/database.types";

export function CopyProfileButton({ profile }: { profile: ProfileRow | null }) {
  const router = useRouter();
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    if (!profile) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    const lines = [
      profile.full_name && `Name: ${profile.full_name}`,
      profile.headline && `Headline: ${profile.headline}`,
      profile.location && `Location: ${profile.location}`,
      profile.phone && `Phone: ${profile.phone}`,
      ...Object.entries(profile.links ?? {}).map(([k, v]) => v && `${k[0].toUpperCase() + k.slice(1)}: ${v}`),
      profile.resume_text && `\n--- Résumé ---\n${profile.resume_text}`,
    ].filter(Boolean);

    if (lines.length === 0) {
      toast.info("Your profile is empty — fill it in first.", {
        action: { label: "Open profile", onClick: () => router.push("/profile") },
      });
      return;
    }
    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    toast.success("Profile copied — paste it into the application form.");
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Button variant="outline" className="gap-2" onClick={copy}>
      {copied ? <ClipboardCheck className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
      Copy my profile
    </Button>
  );
}

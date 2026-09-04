"use client";

import * as React from "react";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function ResumeUpload({
  userId,
  initialPath,
  onChange,
}: {
  userId: string;
  initialPath: string | null;
  onChange: (path: string | null) => void;
}) {
  const supabase = React.useMemo(() => createClient(), []);
  const [path, setPath] = React.useState<string | null>(initialPath);
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Résumé must be under 5 MB.");
      return;
    }
    setBusy(true);
    const ext = file.name.split(".").pop() || "pdf";
    const key = `${userId}/resume.${ext}`;
    const { error } = await supabase.storage
      .from("resumes")
      .upload(key, file, { upsert: true, contentType: file.type });
    setBusy(false);
    if (error) {
      toast.error(`Upload failed: ${error.message}`);
      return;
    }
    setPath(key);
    onChange(key);
    toast.success("Résumé uploaded.");
  };

  const remove = async () => {
    if (!path) return;
    setBusy(true);
    await supabase.storage.from("resumes").remove([path]);
    setBusy(false);
    setPath(null);
    onChange(null);
  };

  return (
    <div className="flex items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      {path ? (
        <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="max-w-[180px] truncate">{path.split("/").pop()}</span>
          <button onClick={remove} disabled={busy} className="text-muted-foreground hover:text-destructive">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Upload résumé
        </Button>
      )}
    </div>
  );
}

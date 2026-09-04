import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TrackerBoard } from "@/components/tracker-board";
import { ApplicationDialog } from "@/components/application-dialog";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Application tracker" };

export default async function TrackerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/tracker");

  const { data: applications } = await supabase
    .from("applications")
    .select("*")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true })
    .order("updated_at", { ascending: false });

  return (
    <div className="container py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Application tracker</h1>
          <p className="text-sm text-muted-foreground">
            {applications?.length ?? 0} applications across all stages
          </p>
        </div>
        <ApplicationDialog
          trigger={
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Add application
            </Button>
          }
        />
      </div>

      <div className="mt-6">
        <TrackerBoard applications={applications ?? []} />
      </div>
    </div>
  );
}

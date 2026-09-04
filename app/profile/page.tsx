import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/profile-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile & résumé" };

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/profile");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="container max-w-2xl py-10">
      <h1 className="text-2xl font-bold tracking-tight">Profile &amp; résumé</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Used for the &ldquo;Copy my profile&rdquo; button on every job, so you can fill application
        forms in seconds.
      </p>
      <div className="mt-6">
        <ProfileForm userId={user.id} profile={profile ?? null} />
      </div>
    </div>
  );
}

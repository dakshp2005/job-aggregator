import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { companyId, watched } = await req.json();
  if (!companyId) return NextResponse.json({ error: "companyId required" }, { status: 400 });

  if (watched === false) {
    await supabase.from("watches").delete().eq("user_id", user.id).eq("company_id", companyId);
    revalidatePath("/dashboard");
    return NextResponse.json({ watched: false });
  }

  const { error } = await supabase
    .from("watches")
    .upsert({ user_id: user.id, company_id: companyId }, { onConflict: "user_id,company_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidatePath("/dashboard");
  return NextResponse.json({ watched: true });
}

/** Mark the "new since last visit" feed as seen (bumps every watch's last_seen_at). */
export async function PATCH() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await supabase
    .from("watches")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("user_id", user.id);
  revalidatePath("/dashboard");
  return NextResponse.json({ ok: true });
}

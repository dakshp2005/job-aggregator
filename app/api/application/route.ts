import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function POST(req: NextRequest) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const row = {
    user_id: user.id,
    job_id: body.jobId ?? null,
    company_id: body.companyId ?? null,
    title: body.title,
    company_name: body.companyName ?? null,
    apply_url: body.applyUrl ?? null,
    stage: body.stage ?? "saved",
    notes: body.notes ?? null,
    next_action: body.nextAction ?? null,
    next_action_date: body.nextActionDate ?? null,
    applied_at: body.stage && body.stage !== "saved" ? new Date().toISOString() : null,
  };
  if (!row.title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const { data, error } = await supabase.from("applications").insert(row).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidatePath("/tracker");
  return NextResponse.json({ application: data });
}

export async function PATCH(req: NextRequest) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id, ...patch } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const allowed = [
    "stage",
    "notes",
    "next_action",
    "next_action_date",
    "sort_order",
    "title",
    "applied_at",
  ];
  const update: Record<string, unknown> = {};
  for (const k of allowed) if (k in patch) update[k] = patch[k];
  if (patch.stage && patch.stage !== "saved" && !("applied_at" in update)) {
    update.applied_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("applications")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidatePath("/tracker");
  return NextResponse.json({ application: data });
}

export async function DELETE(req: NextRequest) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await supabase.from("applications").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/tracker");
  return NextResponse.json({ ok: true });
}

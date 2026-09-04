import "./_env";
import { requireEnv } from "./_env";
import { createAdminClient } from "@/lib/supabase/admin";

requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.ALERTS_FROM_EMAIL || "OpenRoles <onboarding@resend.dev>";
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

interface QueuedAlert {
  id: string;
  user_id: string;
  job: { title: string; apply_url: string; is_early_career: boolean; companies: { name: string; slug: string } } | null;
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_KEY) {
    console.log(`[dry-run] would email ${to}: ${subject}`);
    return true;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${RESEND_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  if (!res.ok) {
    console.error(`Resend error for ${to}:`, await res.text());
    return false;
  }
  return true;
}

async function main() {
  const admin = createAdminClient();

  const { data: alerts, error } = await admin
    .from("alerts_queue")
    .select("id, user_id, job:jobs(title, apply_url, is_early_career, companies(name, slug))")
    .is("sent_at", null)
    .limit(2000);
  if (error) throw error;
  if (!alerts?.length) {
    console.log("No pending alerts.");
    return;
  }

  // Group by user.
  const byUser = new Map<string, QueuedAlert[]>();
  for (const a of alerts as unknown as QueuedAlert[]) {
    if (!byUser.has(a.user_id)) byUser.set(a.user_id, []);
    byUser.get(a.user_id)!.push(a);
  }

  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailById = new Map((users?.users ?? []).map((u) => [u.id, u.email]));

  for (const [userId, items] of byUser) {
    const email = emailById.get(userId);
    const ids = items.map((i) => i.id);
    if (!email) {
      await admin.from("alerts_queue").update({ sent_at: new Date().toISOString() }).in("id", ids);
      continue;
    }

    const rows = items
      .filter((i) => i.job)
      .map(
        (i) =>
          `<li style="margin-bottom:8px">${i.job!.is_early_career ? "🎓 " : ""}<strong>${i.job!.title}</strong> — ${i.job!.companies.name}<br/>
           <a href="${i.job!.apply_url}">Apply</a> · <a href="${SITE}/company/${i.job!.companies.slug}">All roles</a></li>`,
      )
      .join("");

    const html = `<div style="font-family:system-ui,sans-serif;max-width:560px">
      <h2>New roles at companies you watch</h2>
      <ul style="padding-left:18px">${rows}</ul>
      <p style="color:#666;font-size:13px">You're getting this because you watched these companies on OpenRoles.</p>
    </div>`;

    const okSend = await sendEmail(email, `${items.length} new role${items.length === 1 ? "" : "s"} at companies you watch`, html);
    if (okSend) {
      await admin.from("alerts_queue").update({ sent_at: new Date().toISOString() }).in("id", ids);
      console.log(`Sent ${items.length} alerts to ${email}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

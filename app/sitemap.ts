import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const staticPages: MetadataRoute.Sitemap = [
    { url: base, priority: 1 },
    { url: `${base}/companies`, priority: 0.8 },
    { url: `${base}/transparency`, priority: 0.3 },
  ];

  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("companies")
      .select("slug, updated_at")
      .eq("status", "active")
      .order("open_jobs_count", { ascending: false })
      .limit(5000);

    const companyPages: MetadataRoute.Sitemap = (data ?? []).map((c) => ({
      url: `${base}/company/${c.slug}`,
      lastModified: c.updated_at ?? undefined,
      priority: 0.6,
    }));
    return [...staticPages, ...companyPages];
  } catch {
    return staticPages;
  }
}

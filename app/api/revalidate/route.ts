import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";

/** Called by GitHub Actions after an ingestion run to refresh cached pages. */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let paths: string[] = ["/", "/companies", "/transparency"];
  try {
    const body = await req.json();
    if (Array.isArray(body?.paths)) paths = body.paths;
  } catch {
    /* use defaults */
  }
  paths.forEach((p) => revalidatePath(p));
  return NextResponse.json({ revalidated: paths });
}

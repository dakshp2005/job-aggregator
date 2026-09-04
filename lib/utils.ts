import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const COMBINING_MARKS = /\p{Diacritic}/gu;

/** URL-safe slug from an arbitrary company name. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** "3 days ago" style relative time without pulling a heavy locale bundle. */
export function timeAgo(input: string | Date | null | undefined): string {
  if (!input) return "never";
  const then = typeof input === "string" ? new Date(input) : input;
  const secs = Math.round((Date.now() - then.getTime()) / 1000);
  if (Number.isNaN(secs)) return "unknown";
  const table: [number, string][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.34524, "week"],
    [12, "month"],
    [Number.POSITIVE_INFINITY, "year"],
  ];
  let unit = "second";
  let value = Math.abs(secs);
  for (const [size, name] of table) {
    if (value < size) {
      unit = name;
      break;
    }
    value = value / size;
    unit = name;
  }
  const rounded = Math.floor(value);
  const plural = rounded === 1 ? "" : "s";
  return secs < 0 ? `in ${rounded} ${unit}${plural}` : `${rounded} ${unit}${plural} ago`;
}

export function formatSalary(
  min: number | null,
  max: number | null,
  currency: string | null,
): string | null {
  if (!min && !max) return null;
  const cur = currency || "USD";
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: cur,
      maximumFractionDigits: 0,
      notation: n >= 1000 ? "compact" : "standard",
    }).format(n);
  if (min && max && min !== max) return `${fmt(min)} – ${fmt(max)}`;
  return fmt((min || max)!);
}

export function absoluteUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";
  return path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

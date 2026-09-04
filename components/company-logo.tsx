import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function CompanyLogo({
  domain,
  name,
  size = 40,
  className,
}: {
  domain: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const src = domain
    ? `https://logo.clearbit.com/${domain}`
    : null;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-background",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`${name} logo`}
          width={size}
          height={size}
          className="h-full w-full object-contain p-1"
          loading="lazy"
        />
      ) : (
        <Building2 className="h-1/2 w-1/2 text-muted-foreground" />
      )}
    </span>
  );
}

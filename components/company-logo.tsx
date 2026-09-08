"use client";

import * as React from "react";
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
  const [failed, setFailed] = React.useState(false);
  const src = domain ? `https://logo.clearbit.com/${domain}` : null;
  const showImage = src && !failed;

  return (
    <span
      className={cn(
        // Logos are almost always drawn for a light background — an
        // always-white plate keeps dark-colored marks visible in dark mode
        // instead of vanishing against a near-black card.
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`${name} logo`}
          width={size}
          height={size}
          className="h-full w-full object-contain p-1"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <Building2 className="h-1/2 w-1/2 text-neutral-400" />
      )}
    </span>
  );
}

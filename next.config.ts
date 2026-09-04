import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "logo.clearbit.com" },
      { protocol: "https", hostname: "www.google.com", pathname: "/s2/favicons" },
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
  experimental: {
    // `after()` is stable in Next 15, but keep serverActions body limit generous
    // for résumé text pasted into the profile form.
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Navbar } from "@/components/navbar";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "OpenRoles — every company's open roles in one place",
    template: "%s · OpenRoles",
  },
  description:
    "Search a company and instantly see every open job and interview opening, with a direct link to the real application form. Not indexed yet? Our AI fetches it live.",
  openGraph: {
    title: "OpenRoles",
    description: "Company-centric job search with a self-growing, AI-fetched dataset.",
    url: siteUrl,
    siteName: "OpenRoles",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>
          <Navbar />
          <main className="min-h-[calc(100vh-3.5rem)]">{children}</main>
          <footer className="border-t py-8">
            <div className="container flex flex-col items-center justify-between gap-2 text-sm text-muted-foreground sm:flex-row">
              <p>OpenRoles · public job data, aggregated · non-commercial project</p>
              <a
                href="https://github.com/your-github-username/job-platform"
                className="hover:text-foreground"
              >
                Source &amp; data policy
              </a>
            </div>
          </footer>
          <Toaster richColors closeButton />
        </Providers>
      </body>
    </html>
  );
}

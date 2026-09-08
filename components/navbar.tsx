import Link from "next/link";
import { Briefcase } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SearchCommand } from "@/components/search-command";
import { UserMenu } from "@/components/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";

export async function Navbar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="container flex h-14 items-center gap-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Briefcase className="h-5 w-5" />
          <span>OpenRoles</span>
        </Link>

        <nav className="hidden items-center gap-1 text-sm text-muted-foreground md:flex">
          <Link href="/companies" className="rounded px-3 py-1.5 hover:text-foreground">
            Companies
          </Link>
          <Link href="/companies?tag=early-career" className="rounded px-3 py-1.5 hover:text-foreground">
            New grad
          </Link>
          <Link href="/transparency" className="rounded px-3 py-1.5 hover:text-foreground">
            Freshness
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <SearchCommand signedIn={!!user} />
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

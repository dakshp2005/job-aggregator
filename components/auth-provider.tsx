"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SignInForm } from "@/components/sign-in-form";

interface AuthContextValue {
  user: User | null;
  /** Opens the sign-in dialog instead of navigating. Use for any gated action. */
  requireAuth: (reason?: string) => boolean;
  /** Clears the session (server + client) and reloads to the home page. */
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({
  initialUser,
  children,
}: {
  initialUser: User | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [supabase] = React.useState(() => createClient());
  const [user, setUser] = React.useState<User | null>(initialUser);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [reason, setReason] = React.useState<string | undefined>();

  React.useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) setDialogOpen(false);
      // Re-render server components so the navbar and gated pages pick up the
      // new session. Sign-out is handled by signOut() with a hard reload.
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        router.refresh();
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase, router]);

  const requireAuth = React.useCallback(
    (why?: string) => {
      if (user) return true;
      setReason(why);
      setDialogOpen(true);
      return false;
    },
    [user],
  );

  const signOut = React.useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Local session is still cleared below via the reload; ignore network errors.
    }
    // A full navigation guarantees the server re-renders with the cleared
    // cookie and drops the client router cache.
    window.location.assign("/");
  }, [supabase]);

  return (
    <AuthContext.Provider value={{ user, requireAuth, signOut }}>
      {children}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Sign in to continue</DialogTitle>
            <DialogDescription>
              {reason ?? "Create a free account to see this."}
            </DialogDescription>
          </DialogHeader>
          <SignInForm
            next={typeof window !== "undefined" ? window.location.pathname : "/"}
          />
        </DialogContent>
      </Dialog>
    </AuthContext.Provider>
  );
}

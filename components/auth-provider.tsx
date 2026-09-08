"use client";

import * as React from "react";
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
  const [user, setUser] = React.useState<User | null>(initialUser);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [reason, setReason] = React.useState<string | undefined>();

  React.useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) setDialogOpen(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const requireAuth = React.useCallback(
    (why?: string) => {
      if (user) return true;
      setReason(why);
      setDialogOpen(true);
      return false;
    },
    [user],
  );

  return (
    <AuthContext.Provider value={{ user, requireAuth }}>
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

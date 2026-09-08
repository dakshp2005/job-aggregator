"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Github, Loader2, Lock, Mail, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type View = "password" | "signup";
type OAuthProvider = "github" | "google";
type Loading = "password" | "signup" | "magic" | OAuthProvider | null;

/** Brand mark for the Google button (lucide has no Google icon). */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

/** GitHub + Google — shared by the sign-in and sign-up views. */
function OAuthButtons({
  loading,
  onClick,
}: {
  loading: Loading;
  onClick: (provider: OAuthProvider) => void;
}) {
  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={() => onClick("github")}
        disabled={loading !== null}
      >
        {loading === "github" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Github className="h-4 w-4" />
        )}
        Continue with GitHub
      </Button>
      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={() => onClick("google")}
        disabled={loading !== null}
      >
        {loading === "google" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <GoogleIcon className="h-4 w-4" />
        )}
        Continue with Google
      </Button>
    </div>
  );
}

function OrDivider() {
  return (
    <div className="flex items-center gap-3">
      <Separator className="flex-1" />
      <span className="text-xs text-muted-foreground">or</span>
      <Separator className="flex-1" />
    </div>
  );
}

export function SignInForm({ next = "/dashboard" }: { next?: string }) {
  const router = useRouter();

  const [view, setView] = React.useState<View>("password");
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [magicLinkSent, setMagicLinkSent] = React.useState(false);
  const [loading, setLoading] = React.useState<Loading>(null);
  const [error, setError] = React.useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const goNext = () => {
    router.push(next);
    router.refresh();
  };

  const switchView = (to: View) => {
    setView(to);
    setPassword("");
    setConfirmPassword("");
    setError(null);
  };

  const signInWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading("password");
    setError(null);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    setLoading(null);
    if (error) {
      setError(
        error.message.toLowerCase().includes("invalid")
          ? "Wrong email or password."
          : error.message,
      );
      return;
    }
    goNext();
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!fullName.trim()) {
      setError("Enter your full name.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setLoading("signup");
    const { data, error } = await createClient().auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName.trim() } },
    });
    setLoading(null);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      goNext();
      return;
    }
    // No session means Supabase still has email confirmation switched on.
    setError(
      "Account created, but email confirmation is enabled in Supabase. Turn off " +
        "“Confirm email” under Authentication → Providers → Email to sign in without a link.",
    );
  };

  const sendMagicLink = async () => {
    setError(null);
    if (!email) {
      setError("Enter your email above first.");
      return;
    }
    setLoading("magic");
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
    });
    setLoading(null);
    if (error) {
      setError(error.message);
      return;
    }
    setMagicLinkSent(true);
  };

  const oauth = async (provider: OAuthProvider) => {
    setLoading(provider);
    setError(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) {
      setError(error.message);
      setLoading(null);
    }
  };

  // ── Magic link sent ───────────────────────────────────────────────────────
  if (magicLinkSent) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
          <div>
            <p className="font-medium">Check your inbox</p>
            <p className="text-muted-foreground">
              We sent a magic link to {email}. Open it on this device to sign in.
            </p>
          </div>
        </div>
        {error && <p className="text-center text-sm text-destructive">{error}</p>}
        <button
          type="button"
          className="w-full text-center text-xs text-muted-foreground underline underline-offset-2"
          onClick={() => {
            setMagicLinkSent(false);
            setError(null);
          }}
        >
          Back to sign in
        </button>
      </div>
    );
  }

  // ── Create account ────────────────────────────────────────────────────────
  if (view === "signup") {
    return (
      <div className="space-y-4">
        <OAuthButtons loading={loading} onClick={oauth} />
        <OrDivider />
        <form onSubmit={signUp} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="signup-name">Full name</Label>
            <Input
              id="signup-name"
              type="text"
              required
              autoComplete="name"
              placeholder="Ada Lovelace"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="signup-email">Email</Label>
            <Input
              id="signup-email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="signup-password">Password</Label>
            <Input
              id="signup-password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="signup-confirm-password">Confirm password</Label>
            <Input
              id="signup-confirm-password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full gap-2" disabled={loading !== null}>
            {loading === "signup" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            Create account
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <p className="text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <button
              type="button"
              className="font-medium text-foreground underline underline-offset-2"
              onClick={() => switchView("password")}
            >
              Sign in
            </button>
          </p>
        </form>
      </div>
    );
  }

  // ── Sign in ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <OAuthButtons loading={loading} onClick={oauth} />
      <OrDivider />

      <form onSubmit={signInWithPassword} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="signin-email">Email</Label>
          <Input
            id="signin-email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="signin-password">Password</Label>
          <Input
            id="signin-password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full gap-2" disabled={loading !== null}>
          {loading === "password" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Lock className="h-4 w-4" />
          )}
          Sign in
        </Button>
      </form>

      <Button
        type="button"
        variant="ghost"
        className="w-full gap-2"
        onClick={sendMagicLink}
        disabled={loading !== null}
      >
        {loading === "magic" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Mail className="h-4 w-4" />
        )}
        Email me a magic link
      </Button>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <p className="text-center text-xs text-muted-foreground">
        New here?{" "}
        <button
          type="button"
          className="font-medium text-foreground underline underline-offset-2"
          onClick={() => switchView("signup")}
        >
          Create an account
        </button>
      </p>
    </div>
  );
}

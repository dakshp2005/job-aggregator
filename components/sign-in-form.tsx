"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Github, Mail, Loader2, CheckCircle2, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const RESEND_COOLDOWN_MS = 60_000;

function readSent(key: string): { email: string; sentAt: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSent(key: string, email: string) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify({ email, sentAt: Date.now() }));
  } catch {
    /* ignore storage failures (private browsing, etc.) */
  }
}

/** Countdown text for a resend cooldown, or a clickable resend link once it's over. */
function ResendHint({
  sentAt,
  loading,
  onResend,
}: {
  sentAt: number;
  loading: boolean;
  onResend: () => void;
}) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const remaining = Math.max(0, RESEND_COOLDOWN_MS - (now - sentAt));
  return (
    <p className="text-center text-xs text-muted-foreground">
      Didn&apos;t get it?{" "}
      {remaining > 0 ? (
        <span>Resend in {Math.ceil(remaining / 1000)}s</span>
      ) : (
        <button
          type="button"
          className="font-medium text-foreground underline underline-offset-2"
          onClick={onResend}
          disabled={loading}
        >
          {loading ? "Sending…" : "Resend"}
        </button>
      )}
    </p>
  );
}

type View = "password" | "signup" | "magic";

export function SignInForm({ next = "/dashboard" }: { next?: string }) {
  const router = useRouter();
  const magicStored = React.useMemo(() => readSent("openroles-magic-link"), []);
  const signupStored = React.useMemo(() => readSent("openroles-signup"), []);
  const resetStored = React.useMemo(() => readSent("openroles-reset"), []);

  const [view, setView] = React.useState<View>("password");
  const [email, setEmail] = React.useState(magicStored?.email ?? signupStored?.email ?? "");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState<
    "password" | "signup" | "github" | "magic" | "reset" | null
  >(null);
  const [error, setError] = React.useState<string | null>(null);

  const [magicSentAt, setMagicSentAt] = React.useState(magicStored?.sentAt ?? 0);
  const [signupSentAt, setSignupSentAt] = React.useState(signupStored?.sentAt ?? 0);
  const [resetSentAt, setResetSentAt] = React.useState(resetStored?.sentAt ?? 0);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const goNext = () => {
    router.push(next);
    router.refresh();
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
    setLoading("signup");
    setError(null);
    const { data, error } = await createClient().auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo },
    });
    setLoading(null);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      // Email confirmation is off for this project — the account is live immediately.
      goNext();
      return;
    }
    const at = Date.now();
    setSignupSentAt(at);
    writeSent("openroles-signup", email);
    setView("signup"); // stay, but render() below now shows the "check inbox" panel
  };

  const resendSignupEmail = async () => {
    setLoading("signup");
    setError(null);
    const { error } = await createClient().auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: redirectTo },
    });
    setLoading(null);
    if (error) {
      setError(error.message);
      return;
    }
    const at = Date.now();
    setSignupSentAt(at);
    writeSent("openroles-signup", email);
  };

  const sendMagicLink = async () => {
    setLoading("magic");
    setError(null);
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    setLoading(null);
    if (error) {
      setError(error.message);
      return;
    }
    const at = Date.now();
    setMagicSentAt(at);
    writeSent("openroles-magic-link", email);
  };

  const sendResetLink = async () => {
    setLoading("reset");
    setError(null);
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/auth/reset-password")}`,
    });
    setLoading(null);
    if (error) {
      setError(error.message);
      return;
    }
    const at = Date.now();
    setResetSentAt(at);
    writeSent("openroles-reset", email);
  };

  const github = async () => {
    setLoading("github");
    setError(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo },
    });
    if (error) {
      setError(error.message);
      setLoading(null);
    }
  };

  // ── "check your inbox" panels (persisted across dialog remounts) ──────────
  if (view === "signup" && signupSentAt) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
          <div>
            <p className="font-medium">Confirm your account</p>
            <p className="text-muted-foreground">
              We sent a confirmation link to {email}. Open it, then come back and sign in.
            </p>
          </div>
        </div>
        <ResendHint
          sentAt={signupSentAt}
          loading={loading === "signup"}
          onResend={resendSignupEmail}
        />
        {error && <p className="text-center text-sm text-destructive">{error}</p>}
        <button
          type="button"
          className="w-full text-center text-xs text-muted-foreground underline underline-offset-2"
          onClick={() => setView("password")}
        >
          Back to sign in
        </button>
      </div>
    );
  }

  if (view === "magic" && magicSentAt) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
          <div>
            <p className="font-medium">Check your inbox</p>
            <p className="text-muted-foreground">
              We sent a magic link to {email}. Open it on this device.
            </p>
          </div>
        </div>
        <ResendHint sentAt={magicSentAt} loading={loading === "magic"} onResend={sendMagicLink} />
        {error && <p className="text-center text-sm text-destructive">{error}</p>}
        <button
          type="button"
          className="w-full text-center text-xs text-muted-foreground underline underline-offset-2"
          onClick={() => setView("password")}
        >
          Back to sign in
        </button>
      </div>
    );
  }

  if (resetSentAt && view === "password") {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
          <div>
            <p className="font-medium">Reset link sent</p>
            <p className="text-muted-foreground">
              Open the link we sent to {email} to set a new password.
            </p>
          </div>
        </div>
        <ResendHint sentAt={resetSentAt} loading={loading === "reset"} onResend={sendResetLink} />
        {error && <p className="text-center text-sm text-destructive">{error}</p>}
        <button
          type="button"
          className="w-full text-center text-xs text-muted-foreground underline underline-offset-2"
          onClick={() => {
            setResetSentAt(0);
            try {
              window.sessionStorage.removeItem("openroles-reset");
            } catch {
              /* ignore */
            }
          }}
        >
          Back to sign in
        </button>
      </div>
    );
  }

  // ── Sign up ────────────────────────────────────────────────────────────────
  if (view === "signup") {
    return (
      <form onSubmit={signUp} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="signup-email">Email</Label>
          <Input
            id="signup-email"
            type="email"
            required
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
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full gap-2" disabled={loading !== null}>
          {loading === "signup" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          Create account
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <p className="text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <button
            type="button"
            className="font-medium text-foreground underline underline-offset-2"
            onClick={() => {
              setView("password");
              setError(null);
            }}
          >
            Sign in
          </button>
        </p>
      </form>
    );
  }

  // ── Magic link (alternative to password) ───────────────────────────────────
  if (view === "magic") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMagicLink();
        }}
        className="space-y-4"
      >
        <div className="space-y-1.5">
          <Label htmlFor="magic-email">Email</Label>
          <Input
            id="magic-email"
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full gap-2" disabled={loading !== null}>
          {loading === "magic" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          Send magic link
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button
          type="button"
          className="w-full text-center text-xs text-muted-foreground underline underline-offset-2"
          onClick={() => {
            setView("password");
            setError(null);
          }}
        >
          Use a password instead
        </button>
      </form>
    );
  }

  // ── Password sign-in (default) ──────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <Button variant="outline" className="w-full gap-2" onClick={github} disabled={loading !== null}>
        {loading === "github" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Github className="h-4 w-4" />}
        Continue with GitHub
      </Button>

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>

      <form onSubmit={signInWithPassword} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="password-email">Email</Label>
          <Input
            id="password-email"
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <button
              type="button"
              className="text-xs text-muted-foreground underline underline-offset-2"
              onClick={() => {
                setError(null);
                if (!email) {
                  setError("Enter your email above first.");
                  return;
                }
                sendResetLink();
              }}
              disabled={loading !== null}
            >
              Forgot password?
            </button>
          </div>
          <Input
            id="password"
            type="password"
            required
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full gap-2" disabled={loading !== null}>
          {loading === "password" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          Sign in
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <button
          type="button"
          className="underline underline-offset-2"
          onClick={() => {
            setView("magic");
            setError(null);
          }}
        >
          Use a magic link instead
        </button>
        <button
          type="button"
          className="font-medium text-foreground underline underline-offset-2"
          onClick={() => {
            setView("signup");
            setPassword("");
            setError(null);
          }}
        >
          Create an account
        </button>
      </div>
    </div>
  );
}

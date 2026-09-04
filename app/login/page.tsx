"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Github, Mail, Loader2, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function LoginPage() {
  return (
    <React.Suspense fallback={null}>
      <LoginForm />
    </React.Suspense>
  );
}

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [loading, setLoading] = React.useState<"email" | "github" | null>(null);
  const [error, setError] = React.useState<string | null>(
    params.get("error") ? "Sign-in failed. Please try again." : null,
  );

  const redirectTo = `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback?next=${encodeURIComponent(next)}`;

  const magicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading("email");
    setError(null);
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    setLoading(null);
    if (error) setError(error.message);
    else setSent(true);
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

  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-12">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to OpenRoles</CardTitle>
          <CardDescription>
            Save companies, get alerts, and track your applications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sent ? (
            <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
              <div>
                <p className="font-medium">Check your inbox</p>
                <p className="text-muted-foreground">
                  We sent a magic link to {email}. Open it on this device.
                </p>
              </div>
            </div>
          ) : (
            <>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={github}
                disabled={loading !== null}
              >
                {loading === "github" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Github className="h-4 w-4" />
                )}
                Continue with GitHub
              </Button>

              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">or</span>
                <Separator className="flex-1" />
              </div>

              <form onSubmit={magicLink} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full gap-2" disabled={loading !== null}>
                  {loading === "email" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  Send magic link
                </Button>
              </form>
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}

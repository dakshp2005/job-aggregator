"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignInForm } from "@/components/sign-in-form";

export default function LoginPage() {
  return (
    <React.Suspense fallback={null}>
      <LoginCard />
    </React.Suspense>
  );
}

function LoginCard() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const failed = params.get("error");

  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-12">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to OpenRoles</CardTitle>
          <CardDescription>
            Save companies, get alerts, and track your applications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {failed && (
            <p className="mb-4 text-sm text-destructive">Sign-in failed. Please try again.</p>
          )}
          <SignInForm next={next} />
        </CardContent>
      </Card>
    </div>
  );
}
